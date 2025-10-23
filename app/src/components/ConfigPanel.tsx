import { useRecoilValue } from 'recoil'
import {
  aprBpsState,
  faucetCapState,
  oracleAuthorityState,
  oracleNonceState,
  powDifficultyState,
  powRewardState,
} from '../state/atoms'

const abbreviate = (value: string | null) => {
  if (!value) {
    return '—'
  }
  if (value.length <= 12) {
    return value
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

const formatPct = (bps: number) => (bps / 100).toFixed(2)

const formatTokenAmount = (amount: number) =>
  Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'

export const ConfigPanel = () => {
  const aprBps = useRecoilValue(aprBpsState)
  const faucetCap = useRecoilValue(faucetCapState)
  const powDifficulty = useRecoilValue(powDifficultyState)
  const powReward = useRecoilValue(powRewardState)
  const oracleAuthority = useRecoilValue(oracleAuthorityState)
  const oracleNonce = useRecoilValue(oracleNonceState)

  return (
    <section className="card">
      <div className="section-title">Protocol configuration</div>
      <div className="hstack hstack-wrap" style={{ justifyContent: 'space-between', rowGap: '1rem' }}>
        <div className="stack stack-sm">
          <span className="text-muted">Annual percentage rate</span>
          <strong>{formatPct(aprBps)}%</strong>
        </div>
        <div className="stack stack-sm">
          <span className="text-muted">Per-wallet faucet cap</span>
          <strong>{formatTokenAmount(faucetCap)} tokens</strong>
        </div>
        <div className="stack stack-sm">
          <span className="text-muted">Proof reward</span>
          <strong>{formatTokenAmount(powReward)} tokens</strong>
        </div>
        <div className="stack stack-sm">
          <span className="text-muted">Difficulty target</span>
          <strong>{powDifficulty} leading zero bits</strong>
        </div>
        <div className="stack stack-sm">
          <span className="text-muted">Oracle authority</span>
          <strong>{abbreviate(oracleAuthority)}</strong>
        </div>
        <div className="stack stack-sm">
          <span className="text-muted">Oracle nonce</span>
          <strong>{oracleNonce}</strong>
        </div>
      </div>
    </section>
  )
}
