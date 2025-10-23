use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("C3e8kFFYMsEKxXwjMXix3vKSLfk9WwS1xcHeg5gedjvV");

pub const STATE_SEED: &[u8] = b"state";
pub const VAULT_SEED: &[u8] = b"vault";
pub const MINT_AUTH_SEED: &[u8] = b"mint_auth";
pub const STAKE_ACCOUNT_SEED: &[u8] = b"stake";

pub const SECONDS_PER_YEAR: i64 = 31_536_000; // 365 days
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_POW_DIFFICULTY: u8 = 248;
pub const MAX_PROOF_STORAGE: usize = 64;
pub const POW_DOMAIN: &[u8] = b"skillstake_pow";

#[program]
pub mod skill_stake {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        apr_bps: u64,
        faucet_cap: u64,
        pow_reward: u64,
        pow_difficulty: u8,
        oracle_authority: Pubkey,
    ) -> Result<()> {
        require!(apr_bps <= BPS_DENOMINATOR * 5, SkillStakeError::AprTooHigh);
        require!(
            pow_difficulty <= MAX_POW_DIFFICULTY,
            SkillStakeError::InvalidPowDifficulty
        );

        let admin = ctx.accounts.admin.key();
        let authority = if oracle_authority == Pubkey::default() {
            admin
        } else {
            oracle_authority
        };

        let state = &mut ctx.accounts.state;
        state.admin = admin;
        state.oracle_authority = authority;
        state.mint = ctx.accounts.mint.key();
        state.vault = ctx.accounts.vault.key();
        state.apr_bps = apr_bps;
        state.total_staked = 0;
        state.faucet_cap = faucet_cap;
        state.pow_reward = pow_reward;
        state.pow_difficulty = pow_difficulty;
        state.oracle_nonce = 0;

        // Anchor 0.30: bumps are fields, not a map
        state.bump = ctx.bumps.state;
        state.vault_bump = ctx.bumps.vault;
        state.mint_auth_bump = ctx.bumps.mint_auth;

        Ok(())
    }

    pub fn set_apr(ctx: Context<AdminUpdate>, apr_bps: u64) -> Result<()> {
        require!(apr_bps <= BPS_DENOMINATOR * 5, SkillStakeError::AprTooHigh);
        let state = &mut ctx.accounts.state;
        require_keys_eq!(state.admin, ctx.accounts.admin.key(), SkillStakeError::Unauthorized);
        state.apr_bps = apr_bps;
        Ok(())
    }

    pub fn update_faucet_cap(ctx: Context<AdminUpdate>, faucet_cap: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require_keys_eq!(state.admin, ctx.accounts.admin.key(), SkillStakeError::Unauthorized);
        state.faucet_cap = faucet_cap;
        Ok(())
    }

    pub fn set_oracle_authority(ctx: Context<AdminUpdate>, new_authority: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require_keys_eq!(state.admin, ctx.accounts.admin.key(), SkillStakeError::Unauthorized);
        require!(new_authority != Pubkey::default(), SkillStakeError::InvalidOracleAuthority);
        state.oracle_authority = new_authority;
        Ok(())
    }

    pub fn set_pow_config(
        ctx: Context<OracleUpdate>,
        pow_difficulty: u8,
        pow_reward: u64,
        oracle_nonce: u64,
    ) -> Result<()> {
        require!(
            pow_difficulty <= MAX_POW_DIFFICULTY,
            SkillStakeError::InvalidPowDifficulty
        );

        let state = &mut ctx.accounts.state;
        let authority = ctx.accounts.authority.key();
        require!(
            authority == state.oracle_authority || authority == state.admin,
            SkillStakeError::Unauthorized
        );
        require!(oracle_nonce > state.oracle_nonce, SkillStakeError::StaleOracleUpdate);

        state.pow_difficulty = pow_difficulty;
        state.pow_reward = pow_reward;
        state.oracle_nonce = oracle_nonce;
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, SkillStakeError::InvalidAmount);
        let clock = Clock::get()?;

        let state = &mut ctx.accounts.state;
        require_keys_eq!(state.mint, ctx.accounts.mint.key(), SkillStakeError::MintMismatch);

        let stake_account = &mut ctx.accounts.stake_account;
        if stake_account.owner == Pubkey::default() {
            stake_account.owner = ctx.accounts.user.key();
            stake_account.bump = ctx.bumps.stake_account;
            stake_account.last_accrued_ts = clock.unix_timestamp;
        } else {
            require_keys_eq!(stake_account.owner, ctx.accounts.user.key(), SkillStakeError::Unauthorized);
            accrue_rewards(stake_account, state.apr_bps, clock.unix_timestamp)?;
        }

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        stake_account.amount_staked = stake_account
            .amount_staked
            .checked_add(amount)
            .ok_or(SkillStakeError::MathOverflow)?;
        stake_account.last_accrued_ts = clock.unix_timestamp;

        state.total_staked = state
            .total_staked
            .checked_add(amount)
            .ok_or(SkillStakeError::MathOverflow)?;

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, SkillStakeError::InvalidAmount);
        let clock = Clock::get()?;

        // Take an AccountInfo handle before taking &mut state (avoids E0502)
        let state_ai = ctx.accounts.state.to_account_info();
        let state = &mut ctx.accounts.state;
        let stake_account = &mut ctx.accounts.stake_account;

        require_keys_eq!(state.mint, ctx.accounts.mint.key(), SkillStakeError::MintMismatch);
        require_keys_eq!(stake_account.owner, ctx.accounts.user.key(), SkillStakeError::Unauthorized);
        require!(stake_account.amount_staked >= amount, SkillStakeError::InsufficientStake);

        accrue_rewards(stake_account, state.apr_bps, clock.unix_timestamp)?;

        let seeds = &[STATE_SEED, &[state.bump]];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: state_ai.clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds),
            amount,
        )?;

        stake_account.amount_staked = stake_account
            .amount_staked
            .checked_sub(amount)
            .ok_or(SkillStakeError::MathOverflow)?;
        stake_account.last_accrued_ts = clock.unix_timestamp;

        state.total_staked = state
            .total_staked
            .checked_sub(amount)
            .ok_or(SkillStakeError::MathOverflow)?;

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let clock = Clock::get()?;

        let state = &ctx.accounts.state;
        let stake_account = &mut ctx.accounts.stake_account;

        require_keys_eq!(state.mint, ctx.accounts.mint.key(), SkillStakeError::MintMismatch);
        require_keys_eq!(stake_account.owner, ctx.accounts.user.key(), SkillStakeError::Unauthorized);

        accrue_rewards(stake_account, state.apr_bps, clock.unix_timestamp)?;

        let rewards = stake_account.pending_rewards;
        require!(rewards > 0, SkillStakeError::NothingToClaim);

        let mint_seeds = &[MINT_AUTH_SEED, &[state.mint_auth_bump]];
        let signer = &[&mint_seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: ctx.accounts.mint_auth.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), rewards)?;

        stake_account.pending_rewards = 0;

        Ok(())
    }

    pub fn faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
        require!(amount > 0, SkillStakeError::InvalidAmount);

        let state = &ctx.accounts.state;
        require_keys_eq!(state.mint, ctx.accounts.mint.key(), SkillStakeError::MintMismatch);

        let stake_account = &mut ctx.accounts.stake_account;
        if stake_account.owner == Pubkey::default() {
            stake_account.owner = ctx.accounts.user.key();
            stake_account.bump = ctx.bumps.stake_account;
        } else {
            require_keys_eq!(stake_account.owner, ctx.accounts.user.key(), SkillStakeError::Unauthorized);
        }

        let new_total = stake_account
            .faucet_claimed
            .checked_add(amount)
            .ok_or(SkillStakeError::MathOverflow)?;
        require!(new_total <= state.faucet_cap, SkillStakeError::FaucetCapExceeded);

        let signer = &[&[MINT_AUTH_SEED, &[state.mint_auth_bump]][..]];
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: ctx.accounts.mint_auth.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), amount)?;

        stake_account.faucet_claimed = new_total;
        Ok(())
    }

    pub fn record_proof(ctx: Context<RecordProof>, task_id: u64, nonce: u64) -> Result<()> {
        let clock = Clock::get()?;

        let state = &ctx.accounts.state;
        let stake_account = &mut ctx.accounts.stake_account;

        require_keys_eq!(stake_account.owner, ctx.accounts.user.key(), SkillStakeError::Unauthorized);
        require!(task_id > stake_account.last_task_id, SkillStakeError::ProofTaskReplay);

        accrue_rewards(stake_account, state.apr_bps, clock.unix_timestamp)?;

        let hash = keccak::hashv(&[
            POW_DOMAIN,
            ctx.accounts.user.key().as_ref(),
            state.mint.as_ref(),
            &task_id.to_le_bytes(),
            &nonce.to_le_bytes(),
        ]);
        require!(meets_difficulty(&hash.0, state.pow_difficulty), SkillStakeError::ProofDifficultyNotMet);

        if state.pow_reward > 0 {
            stake_account.pending_rewards = stake_account
                .pending_rewards
                .checked_add(state.pow_reward)
                .ok_or(SkillStakeError::MathOverflow)?;
        }

        let proof_record = ProofRecord { task_id, nonce, hash: hash.0 };
        let encoded = proof_record.try_to_vec()?;
        require!(encoded.len() <= MAX_PROOF_STORAGE, SkillStakeError::ProofTooLarge);

        stake_account.last_proof = encoded;
        stake_account.last_proof_ts = clock.unix_timestamp;
        stake_account.last_task_id = task_id;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalState::SPACE,
        seeds = [STATE_SEED],
        bump
    )]
    pub state: Account<'info, GlobalState>,
    /// CHECK: PDA used as mint authority
    #[account(
        seeds = [MINT_AUTH_SEED],
        bump
    )]
    pub mint_auth: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED],
        bump,
        token::mint = mint,
        token::authority = state
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, GlobalState>,
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = state.vault_bump,
        token::mint = mint,
        token::authority = state
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = user
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakeAccount::SPACE,
        seeds = [STAKE_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, GlobalState>,
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = state.vault_bump,
        token::mint = mint,
        token::authority = state
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = user
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_SEED, user.key().as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, GlobalState>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: mint authority PDA
    #[account(
        seeds = [MINT_AUTH_SEED],
        bump = state.mint_auth_bump
    )]
    pub mint_auth: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = user
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_SEED, user.key().as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, GlobalState>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA that is mint authority
    #[account(seeds = [MINT_AUTH_SEED], bump = state.mint_auth_bump)]
    pub mint_auth: UncheckedAccount<'info>,
    #[account(mut, token::mint = mint, token::authority = user)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakeAccount::SPACE,
        seeds = [STAKE_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RecordProof<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, GlobalState>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_SEED, user.key().as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
}

#[derive(Accounts)]
pub struct AdminUpdate<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [STATE_SEED], bump = state.bump, has_one = admin)]
    pub state: Account<'info, GlobalState>,
}

#[derive(Accounts)]
pub struct OracleUpdate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, GlobalState>,
}

#[account]
pub struct GlobalState {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub apr_bps: u64,
    pub total_staked: u64,
    pub faucet_cap: u64,
    pub pow_reward: u64,
    pub oracle_nonce: u64,
    pub pow_difficulty: u8,
    pub bump: u8,
    pub vault_bump: u8,
    pub mint_auth_bump: u8,
    pub _padding: [u8; 4],
}

impl GlobalState {
    // 32*4 + 8*5 + 1*4 + 4 = 32+32+32+32 + 40 + 4 + 4 = 176 bytes
    pub const SPACE: usize = 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 4;
}

#[account]
pub struct StakeAccount {
    pub owner: Pubkey,
    pub amount_staked: u64,
    pub pending_rewards: u64,
    pub faucet_claimed: u64,
    pub last_accrued_ts: i64,
    pub last_proof_ts: i64,
    pub last_task_id: u64,
    pub bump: u8,
    pub _padding: [u8; 7],
    pub last_proof: Vec<u8>, // serialized as len (u32) + bytes
}

impl StakeAccount {
    // 32 + (8*6) + 1 + 7 + 4 + MAX_PROOF_STORAGE
    pub const SPACE: usize = 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 7 + 4 + MAX_PROOF_STORAGE;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProofRecord {
    pub task_id: u64,
    pub nonce: u64,
    pub hash: [u8; 32],
}

#[error_code]
pub enum SkillStakeError {
    #[msg("APR too high for devnet demo settings")]
    AprTooHigh,
    #[msg("Operation would overflow maths")]
    MathOverflow,
    #[msg("Provided amount must be greater than zero")]
    InvalidAmount,
    #[msg("Nothing to claim yet")]
    NothingToClaim,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("Caller is not authorized for this action")]
    Unauthorized,
    #[msg("Missing PDA bump in context")]
    BumpNotFound,
    #[msg("Provided mint does not match program state")]
    MintMismatch,
    #[msg("Proof payload too large")]
    ProofTooLarge,
    #[msg("Faucet cap exceeded for this wallet")]
    FaucetCapExceeded,
    #[msg("Oracle authority must be a valid public key")]
    InvalidOracleAuthority,
    #[msg("Proof of work difficulty is invalid for this program")]
    InvalidPowDifficulty,
    #[msg("Oracle update nonce is stale")]
    StaleOracleUpdate,
    #[msg("Proof does not satisfy the difficulty target")]
    ProofDifficultyNotMet,
    #[msg("Task identifier has already been used")]
    ProofTaskReplay,
}

fn meets_difficulty(hash: &[u8; 32], difficulty: u8) -> bool {
    if difficulty == 0 {
        return true;
    }
    let mut remaining = difficulty;
    for byte in hash.iter() {
        let zeros = byte.leading_zeros() as u8;
        if zeros >= remaining {
            return true;
        }
        if zeros < 8 {
            return false;
        }
        remaining = remaining.saturating_sub(8);
    }
    false
}

fn accrue_rewards(
    stake_account: &mut Account<StakeAccount>,
    apr_bps: u64,
    now_ts: i64,
) -> Result<()> {
    let elapsed = now_ts.checked_sub(stake_account.last_accrued_ts).unwrap_or_default();
    if elapsed <= 0 || stake_account.amount_staked == 0 {
        stake_account.last_accrued_ts = now_ts;
        return Ok(());
    }

    let stake_amount = stake_account.amount_staked as u128;
    let apr = apr_bps as u128;
    let elapsed_u = elapsed as u128;

    let numerator = stake_amount
        .checked_mul(apr)
        .and_then(|v| v.checked_mul(elapsed_u))
        .ok_or(SkillStakeError::MathOverflow)?;
    let denominator = (BPS_DENOMINATOR as u128)
        .checked_mul(SECONDS_PER_YEAR as u128)
        .ok_or(SkillStakeError::MathOverflow)?;
    let newly_accrued = numerator.checked_div(denominator).ok_or(SkillStakeError::MathOverflow)?;

    stake_account.pending_rewards = stake_account
        .pending_rewards
        .checked_add(newly_accrued as u64)
        .ok_or(SkillStakeError::MathOverflow)?;
    stake_account.last_accrued_ts = now_ts;

    Ok(())
}
