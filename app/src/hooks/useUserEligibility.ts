import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { PublicKey, Transaction } from '@solana/web3.js'
import { useSkillStakeProgram } from './useSkillStakeProgram'
import { useSkillStakeWallet } from './useSkillStakeWallet'
import { useToast } from './useToast'
import { getMintPublicKey } from '../config/appConfig'
import { seed } from '../utils/seeds'

const STATE_SEED = seed('state')

type EligibilityIssue = 'stateNotInitialized' | 'missingTokenAccount' | 'unexpected'

type EligibilityStatus = 'disconnected' | 'checking' | 'ready' | 'blocked'

interface EligibilityState {
  status: EligibilityStatus
  message: string | null
  issues: EligibilityIssue[]
  retry: () => void
  isCreatingAta: boolean
  createTokenAccount: () => Promise<void>
  associatedTokenAddress: PublicKey | null
}

export const useUserEligibility = (): EligibilityState => {
  const program = useSkillStakeProgram()
  const { wallet, publicKey, connected, connection } = useSkillStakeWallet()
  const { pushToast } = useToast()

  const [status, setStatus] = useState<EligibilityStatus>('disconnected')
  const [message, setMessage] = useState<string | null>('Connect your wallet to get started.')
  const [issues, setIssues] = useState<EligibilityIssue[]>([])
  const [tick, setTick] = useState(0)
  const [associatedTokenAddress, setAssociatedTokenAddress] = useState<PublicKey | null>(null)
  const [isCreatingAta, setIsCreatingAta] = useState(false)

  const mint = useMemo(() => getMintPublicKey(), [])

  useEffect(() => {
    let cancelled = false

    const evaluate = async () => {
      if (!connected || !publicKey) {
        if (cancelled) return
        setStatus('disconnected')
        setMessage('Connect your wallet to start using SkillStake.')
        setIssues([])
        setAssociatedTokenAddress(null)
        return
      }

      if (!program) {
        if (cancelled) return
        setStatus('checking')
        setMessage('Preparing SkillStake program client...')
        setIssues([])
        return
      }

      setStatus('checking')
      setMessage('Checking your wallet setup…')
      const foundIssues: EligibilityIssue[] = []

      try {
        const [statePda] = PublicKey.findProgramAddressSync([STATE_SEED], program.programId)
        const stateAccount = await (program.account as any).globalState.fetchNullable(statePda)
        if (!stateAccount) {
          foundIssues.push('stateNotInitialized')
        }

        const ata = getAssociatedTokenAddressSync(
          mint,
          publicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        )
        setAssociatedTokenAddress(ata)

        const ataInfo = await connection.getAccountInfo(ata)
        if (!ataInfo) {
          foundIssues.push('missingTokenAccount')
        }

        if (cancelled) {
          return
        }

        if (foundIssues.length === 0) {
          setStatus('ready')
          setMessage(null)
          setIssues([])
          return
        }

        setStatus('blocked')
        setIssues(foundIssues)
        if (foundIssues.includes('stateNotInitialized')) {
          setMessage('The SkillStake program is not initialized. Ask the admin to run the initialize instruction.')
        } else if (foundIssues.includes('missingTokenAccount')) {
          setMessage('Create the Reverios token account for your wallet to continue.')
        } else {
          setMessage('Additional setup is required before you can continue.')
        }
      } catch (error) {
        if (cancelled) {
          return
        }
        setStatus('blocked')
        setIssues(['unexpected'])
        const description = error instanceof Error ? error.message : 'Unknown error'
        setMessage(`Failed to verify wallet readiness: ${description}`)
      }
    }

    void evaluate()

    return () => {
      cancelled = true
    }
  }, [connected, publicKey?.toBase58(), program?.programId.toBase58(), connection.rpcEndpoint, mint.toBase58(), tick])

  const retry = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  const createTokenAccount = useCallback(async () => {
    if (!wallet || !wallet.sendTransaction || !publicKey) {
      pushToast({
        title: 'Wallet action unavailable',
        description: 'Reconnect your wallet and try again.',
        variant: 'error',
      })
      return
    }

    if (!associatedTokenAddress) {
      pushToast({
        title: 'Token account unavailable',
        description: 'Retry the readiness check before creating the account.',
        variant: 'error',
      })
      return
    }

    setIsCreatingAta(true)
    try {
      const ix = createAssociatedTokenAccountInstruction(
        publicKey,
        associatedTokenAddress,
        publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      )

      const transaction = new Transaction().add(ix)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signature = await wallet.sendTransaction(transaction, connection)
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')

      pushToast({
        title: 'Token account created',
        description: 'Your wallet is now ready to interact with Reverios.',
        variant: 'success',
      })
      retry()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create token account.'
      pushToast({
        title: 'Token account creation failed',
        description: message,
        variant: 'error',
      })
    } finally {
      setIsCreatingAta(false)
    }
  }, [wallet, publicKey, associatedTokenAddress, mint, connection, pushToast, retry])

  return {
    status,
    message,
    issues,
    retry,
    isCreatingAta,
    createTokenAccount,
    associatedTokenAddress,
  }
}
