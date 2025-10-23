import { useCallback, useState } from 'react'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, LAMPORTS_PER_SOL, SendTransactionError } from '@solana/web3.js'
import { useSkillStakeProgram, BN } from './useSkillStakeProgram'
import { useSkillStakeWallet } from './useSkillStakeWallet'
import { getFaucetAmount, getMintPublicKey, getTokenDecimals } from '../config/appConfig'
import { useToast } from './useToast'
import { toBaseUnits } from '../utils/token'
import { seed } from '../utils/seeds'

const STATE_SEED = seed('state')
const MINT_AUTH_SEED = seed('mint_auth')
const STAKE_SEED = seed('stake')

export const useFaucet = (options: { onComplete?: () => Promise<void> | void } = {}) => {
  const program = useSkillStakeProgram()
  const { publicKey, connection, connected, connectWallet } = useSkillStakeWallet()
  const { pushToast } = useToast()
  const [isRequesting, setIsRequesting] = useState(false)

  const mint = getMintPublicKey()
  const decimals = getTokenDecimals()
  const defaultAmount = getFaucetAmount()

  const requestFaucet = useCallback(
    async (uiAmount?: number) => {
      const requestAmount = uiAmount ?? defaultAmount
      if (!connected || !publicKey) {
        await connectWallet()
        pushToast({
          title: 'Connect wallet first',
          description: 'Connect your wallet to request faucet funds.',
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
        baseUnits = toBaseUnits(requestAmount.toString(), decimals)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid faucet amount'
        pushToast({ title: 'Invalid amount', description: message, variant: 'error' })
        return
      }

      setIsRequesting(true)
      try {
        // Ensure enough SOL for creating stake account/ATA if needed
        const minLamports = 0.02 * LAMPORTS_PER_SOL
        const balance = await connection.getBalance(publicKey)
        if (balance < minLamports) {
          const endpoint = (connection as any)._rpcEndpoint ?? ''
          const isDev = typeof endpoint === 'string' && endpoint.includes('devnet')
          if (isDev) {
            try {
              await connection.requestAirdrop(publicKey, Math.ceil(0.1 * LAMPORTS_PER_SOL))
              await new Promise((r) => setTimeout(r, 1200))
            } catch {}
          }
        }

        const [statePda] = PublicKey.findProgramAddressSync([STATE_SEED], program.programId)
        const [mintAuthPda] = PublicKey.findProgramAddressSync([MINT_AUTH_SEED], program.programId)
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
          .faucet(baseUnits)
          .accounts({
            user: publicKey,
            state: statePda,
            mint,
            mintAuth: mintAuthPda,
            userToken,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            stakeAccount: stakePda,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .preInstructions(preInstructions)
          .rpc()

        pushToast({
          title: 'Faucet success',
          description: `Minted ${requestAmount} tokens to your wallet.`,
          variant: 'success',
        })

        if (options.onComplete) {
          await options.onComplete()
        }
      } catch (error) {
        let message = error instanceof Error ? error.message : 'Transaction failed.'
        try {
          if (error instanceof SendTransactionError && typeof error.getLogs === 'function') {
            const logs = await error.getLogs(connection)
            if (logs && logs.length) {
              message = `${message}\n${logs[logs.length - 1]}`
              // eslint-disable-next-line no-console
              console.error('Faucet tx logs:', logs)
            }
          }
        } catch {}
        pushToast({
          title: 'Faucet failed',
          description: message,
          variant: 'error',
        })
      } finally {
        setIsRequesting(false)
      }
    },
    [program, publicKey, mint, decimals, defaultAmount, connection, connected, connectWallet, pushToast, options],
  )

  return { requestFaucet, isRequesting, defaultAmount }
}
