import { FormEvent, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { powDifficultyState, powRewardState } from '../state/atoms'
import { useProofOfWork } from '../hooks/useProofOfWork'
import { useRecordProof } from '../hooks/useRecordProof'
import { useToast } from '../hooks/useToast'

interface ProofOfWorkCardProps {
  onSubmitted?: () => Promise<void> | void
}

const formatTokenAmount = (amount: number) =>
  Number.isFinite(amount) ? amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'

export const ProofOfWorkCard = ({ onSubmitted }: ProofOfWorkCardProps) => {
  const powDifficulty = useRecoilValue(powDifficultyState)
  const powReward = useRecoilValue(powRewardState)
  const { solve, verifyNonce, isSolving } = useProofOfWork()
  const { submitProof, isSubmitting } = useRecordProof({ onComplete: onSubmitted })
  const { pushToast } = useToast()

  const [taskId, setTaskId] = useState(() => Math.floor(Date.now() / 1000).toString())
  const [nonce, setNonce] = useState('')
  const [hash, setHash] = useState<string | null>(null)
  const [iterations, setIterations] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const handleSolve = async () => {
    if (!taskId.trim()) {
      pushToast({ title: 'Task ID required', description: 'Provide a numeric task identifier.', variant: 'error' })
      return
    }

    const controller = new AbortController()
    setAbortController(controller)
    setHash(null)
    setIterations(null)
    setDurationMs(null)

    try {
      const result = await solve(taskId, { startingNonce: nonce, signal: controller.signal })
      setNonce(result.nonce)
      setHash(result.hashHex)
      setIterations(result.iterations)
      setDurationMs(result.durationMs)
      pushToast({
        title: 'Proof candidate ready',
        description: `Found nonce ${result.nonce} in ${result.iterations} iterations.`,
        variant: 'success',
      })
    } catch (error) {
      if (controller.signal.aborted) {
        pushToast({
          title: 'Proof search cancelled',
          description: 'Stopped searching for nonce.',
          variant: 'info',
        })
      } else {
        const message = error instanceof Error ? error.message : 'Failed to compute proof.'
        pushToast({
          title: 'Proof search failed',
          description: message,
          variant: 'error',
        })
      }
    } finally {
      controller.abort()
      setAbortController(null)
    }
  }

  const handleCancelSolve = () => {
    abortController?.abort()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!taskId.trim() || !nonce.trim()) {
      pushToast({
        title: 'Missing proof data',
        description: 'Task ID and nonce are required to submit a proof.',
        variant: 'error',
      })
      return
    }

    const verification = verifyNonce(taskId, nonce)
    if (!verification.valid) {
      pushToast({
        title: 'Proof invalid',
        description: 'Nonce does not satisfy the current difficulty target.',
        variant: 'error',
      })
      return
    }

    setHash(verification.hashHex)
    await submitProof({ taskId, nonce })
  }

  return (
    <section className="card stack">
      <div className="stack stack-sm">
        <div className="section-title">Proof of work</div>
        <p className="text-muted">
          Submit a task-specific proof to earn an additional reward. Difficulty is expressed in leading zero bits for
          the Keccak hash of (domain | wallet | mint | taskId | nonce).
        </p>
        <div className="hstack hstack-wrap" style={{ gap: '1.5rem' }}>
          <span className="pill">Difficulty: {powDifficulty} bits</span>
          <span className="pill text-accent">Reward: {formatTokenAmount(powReward)} tokens</span>
        </div>
      </div>

      <form className="stack stack-sm" onSubmit={handleSubmit}>
        <label htmlFor="pow-task">Task identifier</label>
        <div className="hstack hstack-wrap">
          <input
            id="pow-task"
            type="number"
            min="0"
            step="1"
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => setTaskId(Math.floor(Date.now() / 1000).toString())}
          >
            New task
          </button>
        </div>

        <label htmlFor="pow-nonce">Nonce</label>
        <input
          id="pow-nonce"
          type="number"
          min="0"
          step="1"
          value={nonce}
          onChange={(event) => setNonce(event.target.value)}
          placeholder="Enter or compute a nonce"
        />

        <div className="hstack hstack-wrap">
          <button className="btn btn-outline" type="button" disabled={isSolving} onClick={handleSolve}>
            {isSolving ? 'Searching...' : 'Auto compute'}
          </button>
          {isSolving ? (
            <button className="btn btn-outline" type="button" onClick={handleCancelSolve}>
              Cancel search
            </button>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit proof'}
          </button>
        </div>
      </form>

      {hash ? (
        <div className="stack stack-sm">
          <span className="text-muted">Hash (keccak256)</span>
          <code style={{ wordBreak: 'break-all' }}>{hash}</code>
          {iterations && durationMs ? (
            <span className="text-muted">
              Found after {iterations} iterations in {durationMs.toFixed(0)} ms
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
