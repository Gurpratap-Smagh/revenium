import { useRecoilValue } from 'recoil'
import { ConfigPanel } from '../components/ConfigPanel'
import { FaucetButton } from '../components/FaucetButton'
import { OverviewMetrics } from '../components/OverviewMetrics'
import { StakingForm } from '../components/StakingForm'
import { ProofOfWorkCard } from '../components/ProofOfWorkCard'
import { useFaucet } from '../hooks/useFaucet'
import { useSkillStakeData } from '../hooks/useSkillStakeData'
import { useStake } from '../hooks/useStake'
import { pendingRewardsState, tokenBalanceState, totalStakedState } from '../state/atoms'

export const Dashboard = () => {
  const tokenBalance = useRecoilValue(tokenBalanceState)
  const totalStaked = useRecoilValue(totalStakedState)
  const pendingRewards = useRecoilValue(pendingRewardsState)

  const { refresh, isRefreshing } = useSkillStakeData()
  const { amount, setAmount, stakeTokens, isStaking } = useStake({ onComplete: refresh })
  const { requestFaucet, isRequesting, defaultAmount } = useFaucet({ onComplete: refresh })

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
