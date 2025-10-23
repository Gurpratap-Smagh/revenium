import { useMemo } from 'react'
import { useSkillStakeWallet } from '../hooks/useSkillStakeWallet'

const abbreviate = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`

export const WalletConnectButton = () => {
  const { connected, connecting, address, connectWallet, disconnectWallet, openWalletModal } = useSkillStakeWallet()

  const label = useMemo(() => {
    if (connecting) {
      return 'Connecting...'
    }
    if (connected && address) {
      return abbreviate(address)
    }
    return 'Connect Wallet'
  }, [connecting, connected, address])

  const handlePrimaryClick = async () => {
    if (connected) {
      await disconnectWallet()
      return
    }
    await connectWallet()
  }

  return (
    <div className="actions">
      <button
        className="btn btn-primary"
        disabled={connecting}
        onClick={handlePrimaryClick}
        title={connected && address ? address : 'Connect your Solana wallet'}
      >
        {label}
      </button>
      <button className="btn btn-outline" onClick={openWalletModal}>
        Wallets
      </button>
    </div>
  )
}
