import { useRecoilValue } from 'recoil'
import { ConfigPanel } from '../components/ConfigPanel'
import { FaucetButton } from '../components/FaucetButton'
import { OverviewMetrics } from '../components/OverviewMetrics'
import { StakingForm } from '../components/StakingForm'
import { ProofOfWorkCard } from '../components/ProofOfWorkCard'
import { useFaucet } from '../hooks/useFaucet'
import { useSkillStakeData } from '../hooks/useSkillStakeData'
import { useStake } from '../hooks/useStake'
import { useUserEligibility } from '../hooks/useUserEligibility'
import { useSkillStakeWallet } from '../hooks/useSkillStakeWallet'
import { pendingRewardsState, tokenBalanceState, totalStakedState } from '../state/atoms'

export const Dashboard = () => {
  const tokenBalance = useRecoilValue(tokenBalanceState)
  const totalStaked = useRecoilValue(totalStakedState)
  const pendingRewards = useRecoilValue(pendingRewardsState)

  const { connectWallet } = useSkillStakeWallet()
  const { status, message, issues, retry, createTokenAccount, isCreatingAta } = useUserEligibility()
  const { refresh, isRefreshing } = useSkillStakeData()
  const { amount, setAmount, stakeTokens, isStaking } = useStake({ onComplete: refresh })
  const { requestFaucet, isRequesting, defaultAmount } = useFaucet({ onComplete: refresh })

  if (status !== 'ready') {
    return (
      <div className="gate-container">
        <div className="card gate-card">
          <div className="stack-sm">
            <h2>
              {status === 'checking'
                ? 'Almost there…'
                : status === 'disconnected'
                  ? 'Connect your wallet'
                  : 'Complete setup'}
            </h2>
            {message ? <p className="text-muted">{message}</p> : null}
            {status === 'blocked' && issues.length > 0 ? (
              <div className="gate-issues">
                {issues.includes('stateNotInitialized') ? (
                  <div>Program state account not found. Ask the admin to run `initialize`.</div>
                ) : null}
                {issues.includes('missingTokenAccount') ? (
                  <div>Your wallet needs the Reverios token account before you can continue.</div>
                ) : null}
                {issues.includes('unexpected') ? <div>Unexpected error encountered. Retry in a moment.</div> : null}
              </div>
            ) : null}
          </div>

          <div className="gate-actions">
            {status === 'disconnected' ? (
              <button className="btn btn-primary" onClick={async () => await connectWallet()}>
                Connect Wallet
              </button>
            ) : null}
            {status === 'blocked' && issues.includes('missingTokenAccount') ? (
              <button
                className="btn btn-primary"
                onClick={async () => await createTokenAccount()}
                disabled={isCreatingAta}
              >
                {isCreatingAta ? 'Creating token account…' : 'Create token account'}
              </button>
            ) : null}
            {status === 'blocked' ? (
              <button className="btn btn-outline" onClick={retry}>
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <OverviewMetrics
        totalStaked={totalStaked}
        tokenBalance={tokenBalance}
        pendingRewards={pendingRewards}
        isRefreshing={isRefreshing}
        onRefresh={async () => {
          await refresh()
        }}
      />

      <ConfigPanel />

      <StakingForm
        amount={amount}
        onAmountChange={setAmount}
        onStake={async () => {
          await stakeTokens()
        }}
        isStaking={isStaking}
        tokenBalance={tokenBalance}
        pendingRewards={pendingRewards}
      />

      <FaucetButton
        amount={defaultAmount}
        isRequesting={isRequesting}
        onRequest={async () => {
          await requestFaucet()
        }}
      />

      <ProofOfWorkCard
        onSubmitted={async () => {
          await refresh()
        }}
      />
    </div>
  )
}
