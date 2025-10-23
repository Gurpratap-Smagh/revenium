import { useState } from 'react'
import type { FormEvent } from 'react'

interface StakingFormProps {
  amount: string
  onAmountChange: (value: string) => void
  onStake: () => Promise<void>
  isStaking: boolean
  tokenBalance: number
  pendingRewards: number
}

export const StakingForm = ({
  amount,
  onAmountChange,
  onStake,
  isStaking,
  tokenBalance,
  pendingRewards,
}: StakingFormProps) => {
  const [hasInteracted, setHasInteracted] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setHasInteracted(false)
    await onStake()
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <div className="stack stack-sm">
        <div className="section-title">Stake tokens</div>
        <p className="text-muted">
          Earn rewards by staking the SkillStake token. Rewards accrue continuously based on the APR configured in the
          program state.
        </p>
      </div>

      <div className="stack stack-sm">
        <label htmlFor="stake-amount">Amount to stake</label>
        <input
          id="stake-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.000001"
          value={amount}
          onChange={(event) => {
            setHasInteracted(true)
            onAmountChange(event.target.value)
          }}
          placeholder="0.00"
        />
        {hasInteracted && !amount && <span className="text-muted">Enter how many tokens you want to stake.</span>}
      </div>

      <div className="hstack hstack-wrap">
        <div className="pill">Wallet balance: {tokenBalance.toLocaleString()}</div>
        <div className="pill text-accent">Pending rewards: {pendingRewards.toLocaleString()}</div>
      </div>

      <button className="btn btn-primary" disabled={isStaking} type="submit">
        {isStaking ? 'Submitting...' : 'Stake now'}
      </button>
    </form>
  )
}
