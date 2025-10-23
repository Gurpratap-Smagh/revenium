import { useCallback, useState } from 'react'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { useSkillStakeProgram, BN } from './useSkillStakeProgram'
import { useSkillStakeWallet } from './useSkillStakeWallet'
import { getFaucetAmount, getMintPublicKey, getTokenDecimals } from '../config/appConfig'
import { useToast } from './useToast'
import { toBaseUnits } from '../utils/token'
import { seed } from '../utils/seeds'

const STATE_SEED = seed('state')
const MINT_AUTH_SEED = seed('mint_auth')

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
          description: 'Connect an admin wallet to request faucet funds.',
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
        const [statePda] = PublicKey.findProgramAddressSync([STATE_SEED], program.programId)
        const [mintAuthPda] = PublicKey.findProgramAddressSync([MINT_AUTH_SEED], program.programId)
        const userToken = getAssociatedTokenAddressSync(mint, publicKey)

        const preInstructions = []
        const accountInfo = await connection.getAccountInfo(userToken)
        if (!accountInfo) {
          preInstructions.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              userToken,
              publicKey,
              mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID,
            ),
          )
        }

        await program.methods
          .faucet(baseUnits)
          .accounts({
            admin: publicKey,
            state: statePda,
            mint,
            mintAuth: mintAuthPda,
            userToken,
            user: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
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
        const message =
          error instanceof Error ? error.message : 'Transaction failed. Ensure your wallet is the admin signer.'
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
