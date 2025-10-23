interface OverviewMetricsProps {
  totalStaked: number
  tokenBalance: number
  pendingRewards: number
  isRefreshing: boolean
  onRefresh: () => Promise<void>
}

const format = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'

export const OverviewMetrics = ({
  totalStaked,
  tokenBalance,
  pendingRewards,
  isRefreshing,
  onRefresh,
}: OverviewMetricsProps) => (
  <section className="stack">
    <div className="hstack" style={{ justifyContent: 'space-between' }}>
      <h2 className="section-title">Overview</h2>
      <button className="btn btn-outline" disabled={isRefreshing} onClick={onRefresh}>
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
    <div className="metric-card">
      <div className="card stack stack-sm">
        <span className="text-muted">Wallet balance</span>
        <span className="brand">{format(tokenBalance)}</span>
      </div>
      <div className="card stack stack-sm">
        <span className="text-muted">Pending rewards</span>
        <span className="brand text-accent">{format(pendingRewards)}</span>
      </div>
      <div className="card stack stack-sm">
        <span className="text-muted">Total value staked</span>
        <span className="brand">{format(totalStaked)}</span>
      </div>
    </div>
  </section>
)
