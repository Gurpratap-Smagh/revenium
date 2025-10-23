import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import { PublicKey } from '@solana/web3.js'
import { useToast } from './useToast'
import type { WalletContextState } from '@solana/wallet-adapter-react'

interface SkillStakeWallet {
  connection: ReturnType<typeof useConnection>['connection']
  wallet: WalletContextState
  publicKey: PublicKey | null
  address: string | null
  connected: boolean
  connecting: boolean
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  openWalletModal: () => void
  hasInstalledWallet: boolean
}

const abbreviate = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`

export const useSkillStakeWallet = (): SkillStakeWallet => {
  const wallet = useWallet()
  const { connection } = useConnection()
  const { setVisible } = useWalletModal()
  const { pushToast } = useToast()
  const [hasWarnedMissingWallet, setHasWarnedMissingWallet] = useState(false)

  const installedWallets = useMemo(
    () => wallet.wallets.filter((candidate) => candidate.readyState === WalletReadyState.Installed),
    [wallet.wallets],
  )

  const publicKey = wallet.publicKey ?? null
  const address = useMemo(() => (publicKey ? publicKey.toBase58() : null), [publicKey])

  useEffect(() => {
    if (wallet.connected && publicKey) {
      pushToast({
        title: 'Wallet connected',
        description: `Ready to stake as ${abbreviate(publicKey.toBase58())}`,
        variant: 'success',
      })
      return
    }

    if (!wallet.connected && wallet.disconnecting === false && wallet.connecting === false && wallet.wallet === null) {
      if (!hasWarnedMissingWallet && installedWallets.length === 0) {
        pushToast({
          title: 'Wallet required',
          description: 'Install or enable a Solana wallet extension (Phantom, Solflare, Backpack) to continue.',
          variant: 'error',
        })
        setHasWarnedMissingWallet(true)
      }
    }
  }, [
    wallet.connected,
    wallet.disconnecting,
    wallet.connecting,
    wallet.wallet,
    publicKey,
    pushToast,
    hasWarnedMissingWallet,
    installedWallets.length,
  ])

  const openWalletModal = useCallback(() => {
    setVisible(true)
  }, [setVisible])

  const connectWallet = useCallback(async () => {
    try {
      if (!wallet.wallet) {
        openWalletModal()
        return
      }
      await wallet.connect()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      pushToast({
        title: 'Connection failed',
        description: message,
        variant: 'error',
      })
    }
  }, [wallet, openWalletModal, pushToast])

  const disconnectWallet = useCallback(async () => {
    try {
      if (wallet.disconnect) {
        await wallet.disconnect()
        pushToast({
          title: 'Disconnected',
          description: 'Wallet disconnected safely.',
          variant: 'info',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      pushToast({
        title: 'Disconnect failed',
        description: message,
        variant: 'error',
      })
    }
  }, [wallet, pushToast])

  return {
    connection,
    wallet,
    publicKey,
    address,
    connected: wallet.connected,
    connecting: wallet.connecting,
    connectWallet,
    disconnectWallet,
    openWalletModal,
    hasInstalledWallet: installedWallets.length > 0,
  }
}
