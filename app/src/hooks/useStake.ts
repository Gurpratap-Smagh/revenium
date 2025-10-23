import { useCallback, useState } from 'react'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL, SendTransactionError } from '@solana/web3.js'
import { useRecoilState } from 'recoil'
import { stakeAmountState } from '../state/atoms'
import { useSkillStakeProgram, BN } from './useSkillStakeProgram'
import { useSkillStakeWallet } from './useSkillStakeWallet'
import { getMintPublicKey, getTokenDecimals } from '../config/appConfig'
import { useToast } from './useToast'
import { toBaseUnits } from '../utils/token'
import { seed } from '../utils/seeds'

const STATE_SEED = seed('state')
const VAULT_SEED = seed('vault')
const STAKE_SEED = seed('stake')

export const useStake = (options: { onComplete?: () => Promise<void> | void } = {}) => {
  const program = useSkillStakeProgram()
  const { publicKey, connected, connectWallet, connection } = useSkillStakeWallet()
  const { pushToast } = useToast()
  const [amount, setAmount] = useRecoilState(stakeAmountState)
  const [isStaking, setIsStaking] = useState(false)

  const decimals = getTokenDecimals()
  const mint = getMintPublicKey()

  const stakeTokens = useCallback(
    async (overrideAmount?: string) => {
      const value = (overrideAmount ?? amount).trim()
      if (!value) {
        pushToast({
          title: 'Amount required',
          description: 'Enter the number of tokens you want to stake.',
          variant: 'error',
        })
        return
      }

      if (!connected || !publicKey) {
        await connectWallet()
        pushToast({
          title: 'Connect wallet first',
          description: 'Please connect a wallet before staking.',
          variant: 'info',
        })
        return
      }

      if (!program) {
        pushToast({
          title: 'Program unavailable',
          description: 'SkillStake program is not ready. Double-check your Anchor deployment.',
          variant: 'error',
        })
        return
      }

      let baseUnits: BN
      try {
        baseUnits = toBaseUnits(value, decimals)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid amount'
        pushToast({ title: 'Invalid amount', description: message, variant: 'error' })
        return
      }

      if (baseUnits.lte(new BN(0))) {
        pushToast({
          title: 'Nothing to stake',
          description: 'Provide a positive amount of tokens.',
          variant: 'error',
        })
        return
      }

      setIsStaking(true)
      try {
        // Ensure the wallet has enough SOL to create the stake account/ATA and pay fees.
        const minLamports = 0.02 * LAMPORTS_PER_SOL // ~0.02 SOL buffer
        const balance = await connection.getBalance(publicKey)
        if (balance < minLamports) {
          // Attempt airdrop on devnet endpoints; otherwise inform the user.
          const endpoint = (connection as any)._rpcEndpoint ?? ''
          const isDev = typeof endpoint === 'string' && endpoint.includes('devnet')
          if (isDev) {
            try {
              await connection.requestAirdrop(publicKey, Math.ceil(0.1 * LAMPORTS_PER_SOL))
              // Small wait for airdrop to finalize; not blocking on confirmation to keep snappy.
              await new Promise((r) => setTimeout(r, 1200))
            } catch {
              // fallthrough to user message
            }
          }
        }

        const [statePda] = PublicKey.findProgramAddressSync([STATE_SEED], program.programId)
        const [vaultPda] = PublicKey.findProgramAddressSync([VAULT_SEED], program.programId)
        const [stakePda] = PublicKey.findProgramAddressSync([STAKE_SEED, publicKey.toBuffer()], program.programId)
        const userToken = getAssociatedTokenAddressSync(
          mint,
          publicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        )

        const preInstructions = []
        const accountInfo = await connection.getAccountInfo(userToken)
        if (!accountInfo) {
          preInstructions.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              userToken,
              publicKey,
              mint,
              TOKEN_2022_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID,
            ),
          )
        }

        await program.methods
          .stake(baseUnits)
          .accounts({
            user: publicKey,
            state: statePda,
            vault: vaultPda,
            mint,
            userToken,
            stakeAccount: stakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .preInstructions(preInstructions)
          .rpc()

        pushToast({
          title: 'Stake submitted',
          description: `Successfully staked ${value} tokens.`,
          variant: 'success',
        })
        setAmount('')

        if (options.onComplete) {
          await options.onComplete()
        }
      } catch (error) {
        let message = error instanceof Error ? error.message : 'Transaction failed.'
        // Enhance error message with logs when available
        try {
          if (error instanceof SendTransactionError && typeof error.getLogs === 'function') {
            const logs = await error.getLogs(connection)
            if (logs && logs.length) {
              // surface the last meaningful log line
              const last = logs[logs.length - 1]
              message = `${message}\n${last}`
              // also print full logs for debugging
              // eslint-disable-next-line no-console
              console.error('Stake tx logs:', logs)
            }
          }
        } catch {
          // ignore
        }
        pushToast({
          title: 'Stake failed',
          description: message,
          variant: 'error',
        })
      } finally {
        setIsStaking(false)
      }
    },
    [
      amount,
      program,
      publicKey,
      connected,
      connectWallet,
      pushToast,
      decimals,
      mint,
      setAmount,
      connection,
      options,
    ],
  )

  return {
    amount,
    setAmount,
    stakeTokens,
    isStaking,
  }
}
