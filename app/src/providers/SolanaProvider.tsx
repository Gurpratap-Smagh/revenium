import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import type { ReactNode } from 'react'

import '@solana/wallet-adapter-react-ui/styles.css'

interface SolanaProviderProps {
  children: ReactNode
}

const resolveEndpoint = () => {
  const endpointFromEnv = import.meta.env.VITE_SOLANA_RPC_ENDPOINT as string | undefined
  if (endpointFromEnv && endpointFromEnv.length > 0) {
    return endpointFromEnv
  }

  const cluster = (import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet') as 'devnet' | 'testnet' | 'mainnet-beta'
  return clusterApiUrl(cluster)
}

export const SolanaProvider = ({ children }: SolanaProviderProps) => {
  const endpoint = useMemo(() => resolveEndpoint(), [])

  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new TorusWalletAdapter()], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
