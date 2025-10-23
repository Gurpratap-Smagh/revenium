import { useCallback, useState } from 'react'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
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
        const [statePda] = PublicKey.findProgramAddressSync([STATE_SEED], program.programId)
        const [vaultPda] = PublicKey.findProgramAddressSync([VAULT_SEED], program.programId)
        const [stakePda] = PublicKey.findProgramAddressSync([STAKE_SEED, publicKey.toBuffer()], program.programId)
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
          .stake(baseUnits)
          .accounts({
            user: publicKey,
            state: statePda,
            vault: vaultPda,
            mint,
            userToken,
            stakeAccount: stakePda,
            tokenProgram: TOKEN_PROGRAM_ID,
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
        const message =
          error instanceof Error ? error.message : 'Transaction failed. Check your wallet for more details.'
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
