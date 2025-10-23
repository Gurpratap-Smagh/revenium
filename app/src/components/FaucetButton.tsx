import { useMemo } from 'react'
import { useRecoilValue } from 'recoil'
import { faucetCapState, faucetClaimedState } from '../state/atoms'

interface FaucetButtonProps {
  onRequest: () => Promise<void>
  isRequesting: boolean
  amount: number
}

const formatTokenAmount = (amount: number) =>
  Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'

export const FaucetButton = ({ onRequest, isRequesting, amount }: FaucetButtonProps) => {
  const faucetCap = useRecoilValue(faucetCapState)
  const faucetClaimed = useRecoilValue(faucetClaimedState)

  const remaining = useMemo(() => Math.max(faucetCap - faucetClaimed, 0), [faucetCap, faucetClaimed])

  return (
    <div className="card stack">
      <div className="stack stack-sm">
        <div className="section-title">Development faucet</div>
        <p className="text-muted">
          Mint tokens directly into your connected wallet. This faucet is only available on devnet and requires the same
          admin wallet that initialized the program.
        </p>
        <div className="hstack hstack-wrap">
          <span className="pill">Per-wallet cap: {formatTokenAmount(faucetCap)} tokens</span>
          <span className="pill text-accent">
            Claimed: {formatTokenAmount(faucetClaimed)} ({formatTokenAmount(remaining)} remaining)
          </span>
        </div>
      </div>
      <button className="btn btn-outline" disabled={isRequesting || remaining <= 0} onClick={onRequest}>
        {isRequesting ? 'Requesting...' : `Get ${amount} tokens`}
      </button>
    </div>
  )
}
