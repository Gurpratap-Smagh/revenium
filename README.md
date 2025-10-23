# SkillStake Monorepo

SkillStake is a Solana devnet staking demo that lets users mint a demo SPL token, stake it to earn time-based rewards, claim those rewards, and unstake when finished. It is built around an Anchor program, a Next.js front-end, scripts for program operations, and an oracle placeholder for future off-chain attestations.

## Repository layout

```
skillstake/
├─ Anchor.toml                # Anchor configuration (update program id)
├─ Cargo.toml                 # Rust workspace
├─ package.json               # JS workspace (scripts + workspaces)
├─ tsconfig.json              # TypeScript config for scripts
├─ idl/
│  └─ skill_stake.json        # Anchor IDL (replace after `anchor build`)
├─ programs/
│  └─ skill_stake/            # Anchor program
├─ scripts/                   # Devnet helper scripts (ts-node)
├─ app/                       # Next.js frontend (wallet UI)
├─ oracle/                    # Placeholder oracle service
└─ token/                     # Existing token metadata server (untouched)
```

## Prerequisites

Install the toolchain once per machine:

```bash
# Rust
curl https://sh.rustup.rs -sSf | sh
rustup default stable

# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
solana config set --url https://api.devnet.solana.com
solana airdrop 2

# Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest
avm use latest

# Node & package manager
corepack enable
corepack prepare pnpm@latest --activate
```

## 1. Build, deploy, and configure the program

1. Generate a new program keypair if you do not already have one:
   ```bash
   solana-keygen new -o target/deploy/skill_stake-keypair.json
   ```
2. Update the program id in both of these files:
   - `programs/skill_stake/src/lib.rs` (`declare_id!` macro)
   - `Anchor.toml` under `[programs.devnet]`
3. Build and deploy to devnet:
   ```bash
   pnpm build:program
   pnpm deploy:program
   ```
4. Capture the printed `PROGRAM_ID` for the next steps.

## 2. Update environment variables

Create a root `.env` (no extension) for scripts:

```
PROGRAM_ID=REPLACE_WITH_PROGRAM_ID
REWARD_MINT=REPLACE_WITH_DEVNET_REWARD_MINT
APR_BPS=1000
```

For the frontend copy `.env.local.example` to `.env.local` and fill in the same values:

```
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=REPLACE_WITH_PROGRAM_ID
NEXT_PUBLIC_MINT=REPLACE_WITH_DEVNET_REWARD_MINT
```

> Replace `REWARD_MINT` with your existing devnet SPL mint. The program will mint rewards against this mint on devnet only.

## 3. Initialize on-chain state

After deploying the program and setting env vars:

```bash
pnpm install
pnpm scripts:devnet-init
```

The script derives PDAs (`state`, `vault`, `mint_auth`), calls the `initialize` instruction with `APR_BPS`, and creates the program-owned vault ATA.

## 4. Delegate mint authority to the program PDA

The reward mint must trust the program’s `mint_auth` PDA in order to faucet and pay rewards:

```bash
pnpm scripts:set-mint-authority
```

Run once while the existing mint authority is available (devnet only). Keep the mint authority elsewhere for production deployments.

## 5. Faucet convenience script (optional)

Mint tokens to your wallet (or a supplied address) for quick testing:

```bash
# Optional overrides: FAUCET_TOKENS, FAUCET_FOR (public key)
pnpm scripts:faucet
```

The script ensures the user’s associated token account exists and invokes the on-chain `faucet` instruction.

## 6. Frontend (Next.js)

```bash
cd app
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Connect your wallet, use the faucet, stake, claim rewards, and unstake. The UI calls the program via Anchor + wallet adapter and uses the IDL in `idl/skill_stake.json` (replace with the fresh IDL after each build).

## 7. Oracle placeholder

```bash
cd ../oracle
pnpm install
pnpm dev
```

An Express server will respond on `http://localhost:8787`. The `/attest` endpoint currently returns dummy payloads; integrate real verification and ed25519 signatures for production.

## 8. Regenerating the IDL

Whenever the program changes, rebuild with Anchor and copy the output IDL (from `target/idl/skill_stake.json`) into `idl/skill_stake.json`. The frontend loads this file directly.

## 9. Troubleshooting

- **PDA mismatch / constraint errors**: verify that `PROGRAM_ID`, `declare_id!`, and env vars all match the deployed program id. Ensure you derived PDAs with the same seeds as the program (`"state"`, `"vault"`, `"mint_auth"`, `"stake"`).
- **Mint authority issues**: rerun `pnpm scripts:set-mint-authority` and confirm the PDA printed by `scripts/devnet_init.ts` matches the mint authority on-chain.
- **Token account ownership errors**: the vault ATA is owned by the program state PDA; user ATAs must be owned by the wallet. The frontend auto-creates the user ATA if it does not exist.
- **IDL mismatch**: if the frontend throws `Account not found` or `instruction not found`, replace `idl/skill_stake.json` with the latest build output.

## 10. What’s next

- Enforce oracle signatures in `record_proof` once the off-chain service is ready.
- Introduce per-mint staking pools (`["pool", mint]` seeds) for multi-asset staking.
- Add cooldowns / rate limits to the faucet before any public devnet demo.
- Remove unlimited minting and faucet logic for mainnet deployments.
