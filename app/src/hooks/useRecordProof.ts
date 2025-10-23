import { useCallback, useState } from 'react'
import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { useToast } from './useToast'
import { useSkillStakeProgram } from './useSkillStakeProgram'
import { useSkillStakeWallet } from './useSkillStakeWallet'
import { parseU64 } from '../utils/u64'
import { seed } from '../utils/seeds'

const STATE_SEED = seed('state')
const STAKE_SEED = seed('stake')

interface UseRecordProofOptions {
  onComplete?: () => Promise<void> | void
}

interface SubmitProofInput {
  taskId: string
  nonce: string
}

export const useRecordProof = (options: UseRecordProofOptions = {}) => {
  const program = useSkillStakeProgram()
  const { publicKey, connected, connectWallet } = useSkillStakeWallet()
  const { pushToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitProof = useCallback(
    async ({ taskId, nonce }: SubmitProofInput) => {
      if (!program) {
        pushToast({
          title: 'Program unavailable',
          description: 'SkillStake program client is not ready on the frontend.',
          variant: 'error',
        })
        return
      }

      if (!connected || !publicKey) {
        await connectWallet()
        pushToast({
          title: 'Connect wallet first',
          description: 'You need to connect a wallet before submitting a proof.',
          variant: 'info',
        })
        return
      }

      let taskIdBig: bigint
      let nonceBig: bigint
      try {
        taskIdBig = parseU64(taskId)
        nonceBig = parseU64(nonce)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid proof parameters'
        pushToast({
          title: 'Invalid proof',
          description: message,
          variant: 'error',
        })
        return
      }

      setIsSubmitting(true)
      try {
        const [statePda] = PublicKey.findProgramAddressSync([STATE_SEED], program.programId)
        const [stakePda] = PublicKey.findProgramAddressSync([STAKE_SEED, publicKey.toBuffer()], program.programId)

        await program.methods
          .recordProof(new BN(taskIdBig.toString()), new BN(nonceBig.toString()))
          .accounts({
            user: publicKey,
            state: statePda,
            stakeAccount: stakePda,
          })
          .rpc()

        pushToast({
          title: 'Proof submitted',
          description: `Recorded task ${taskIdBig.toString()} with nonce ${nonceBig.toString()}.`,
          variant: 'success',
        })

        if (options.onComplete) {
          await options.onComplete()
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Transaction failed. Check your wallet for more details.'
        pushToast({
          title: 'Proof submission failed',
          description: message,
          variant: 'error',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [program, connected, publicKey, connectWallet, pushToast, options],
  )

  return { submitProof, isSubmitting }
}
