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

const normalizeIdl = (rawIdl: unknown, programId: PublicKey): Idl => {
  const cloned: Record<string, unknown> = JSON.parse(JSON.stringify(rawIdl ?? {}))

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }

    if (node && typeof node === 'object') {
      Object.entries(node).forEach(([key, value]) => {
        if (typeof value === 'string' && value === 'publicKey') {
          ;(node as Record<string, unknown>)[key] = 'pubkey'
        } else {
          walk(value)
        }
      })
    }
  }

  walk(cloned)

  if (!Array.isArray(cloned.types)) {
    const accountTypes =
      Array.isArray(cloned.accounts) ?
        (cloned.accounts as Array<Record<string, unknown>>).map((account) => ({
          name: account.name,
          type: account.type,
          docs: account.docs,
        })) :
        []
    cloned.types = accountTypes
  }

  cloned.address = programId.toBase58()
  return cloned as Idl
}

export const SKILL_STAKE_PROGRAM_ID = new PublicKey(getProgramAddress())

export const useSkillStakeProgram = () => {
  const wallet = useWallet()
  const { connection } = useConnection()

  return useMemo(() => {
    // Build a provider that works for reads even if no wallet is connected.
    const anchorWallet: AnchorWallet = wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions
      ? {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions,
        }
      : {
          publicKey: wallet.publicKey ?? PublicKey.default,
          signTransaction: async (tx) => tx,
          signAllTransactions: async (txs) => txs,
        }

    const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions())
    const hydratedIdl = normalizeIdl(idl, SKILL_STAKE_PROGRAM_ID)
    // Memoize only on connection endpoint and wallet.publicKey so identity is stable across renders.
    return new Program(hydratedIdl, provider)
  }, [connection, wallet.publicKey])
}

export { BN }
