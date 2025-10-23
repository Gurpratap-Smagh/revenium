import { useMemo } from 'react'
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import idl from '../idl/skill_stake.json'
import { getProgramAddress } from '../config/appConfig'

import type { Idl } from '@coral-xyz/anchor'

interface AnchorWallet {
  publicKey: PublicKey
  signTransaction: AnchorProvider['wallet']['signTransaction']
  signAllTransactions: AnchorProvider['wallet']['signAllTransactions']
}

export const SKILL_STAKE_PROGRAM_ID = new PublicKey(getProgramAddress())

export const useSkillStakeProgram = () => {
  const wallet = useWallet()
  const { connection } = useConnection()

  return useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      return null
    }

    const anchorWallet: AnchorWallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    }

    const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions())
    const hydratedIdl = { ...(idl as Record<string, unknown>), address: SKILL_STAKE_PROGRAM_ID.toBase58() }
    return new Program(hydratedIdl as unknown as Idl, provider)
  }, [wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions, connection, SKILL_STAKE_PROGRAM_ID])
}

export { BN }
