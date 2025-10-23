import { useCallback, useMemo, useState } from 'react'
import { keccak_256 } from 'js-sha3'
import { useRecoilValue } from 'recoil'
import { powDifficultyState } from '../state/atoms'
import { useSkillStakeWallet } from './useSkillStakeWallet'
import { getMintPublicKey } from '../config/appConfig'
import { parseU64, MAX_U64_BIGINT } from '../utils/u64'

const POW_DOMAIN_BYTES = new TextEncoder().encode('skillstake_pow')
const SLICE_INTERVAL = 2048n

const concatBytes = (arrays: Uint8Array[]) => {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  arrays.forEach((arr) => {
    result.set(arr, offset)
    offset += arr.length
  })
  return result
}

const toU64LeBytes = (value: bigint) => {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setBigUint64(0, value, true)
  return new Uint8Array(buffer)
}

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

const meetsDifficulty = (hash: Uint8Array, difficulty: number) => {
  if (difficulty <= 0) {
    return true
  }

  let remaining = difficulty
  for (const byte of hash) {
    const zeros = Math.clz32(byte) - 24 // leading zeros for a byte
    if (zeros >= remaining) {
      return true
    }
    if (zeros < 8) {
      return false
    }
    remaining -= 8
  }
  return false
}

const hashPow = (user: Uint8Array, mint: Uint8Array, taskId: bigint, nonce: bigint) => {
  const payload = concatBytes([POW_DOMAIN_BYTES, user, mint, toU64LeBytes(taskId), toU64LeBytes(nonce)])
  return new Uint8Array(keccak_256.arrayBuffer(payload))
}

interface SolveOptions {
  signal?: AbortSignal
  startingNonce?: string
}

export const useProofOfWork = () => {
  const { publicKey, connectWallet, connected } = useSkillStakeWallet()
  const powDifficulty = useRecoilValue(powDifficultyState)
  const [isSolving, setIsSolving] = useState(false)

  const mintBytes = useMemo(() => getMintPublicKey().toBytes(), [])
  const userBytes = useMemo(() => (publicKey ? publicKey.toBytes() : undefined), [publicKey])

  const verifyNonce = useCallback(
    (taskIdInput: string, nonceInput: string) => {
      if (!publicKey || !connected || !userBytes) {
        return { valid: false, hashHex: null }
      }

      try {
        const taskId = parseU64(taskIdInput)
        const nonce = parseU64(nonceInput)
        const hashBytes = hashPow(userBytes, mintBytes, taskId, nonce)
        const valid = meetsDifficulty(hashBytes, powDifficulty)
        return { valid, hashHex: bytesToHex(hashBytes) }
      } catch {
        return { valid: false, hashHex: null }
      }
    },
    [publicKey, connected, userBytes, mintBytes, powDifficulty],
  )

  const solve = useCallback(
    async (taskIdInput: string, options: SolveOptions = {}) => {
      if (!publicKey || !userBytes) {
        await connectWallet()
        throw new Error('Connect wallet before solving proof of work.')
      }

      const taskId = parseU64(taskIdInput)
      let nonce = options.startingNonce ? parseU64(options.startingNonce) : 0n

      setIsSolving(true)
      const startedAt = performance.now()

      try {
        let iterations = 0n
        while (true) {
          if (options.signal?.aborted) {
            throw new Error('Proof generation cancelled')
          }

          const hashBytes = hashPow(userBytes, mintBytes, taskId, nonce)
          iterations += 1n

          if (meetsDifficulty(hashBytes, powDifficulty)) {
            const durationMs = performance.now() - startedAt
            return {
              nonce: nonce.toString(),
              hashHex: bytesToHex(hashBytes),
              iterations: iterations.toString(),
              durationMs,
            }
          }

          nonce = (nonce + 1n) & MAX_U64_BIGINT

          if (iterations % SLICE_INTERVAL === 0n) {
            await new Promise((resolve) => setTimeout(resolve, 0))
          }
        }
      } finally {
        setIsSolving(false)
      }
    },
    [publicKey, userBytes, mintBytes, powDifficulty, connectWallet],
  )

  return { solve, verifyNonce, isSolving, powDifficulty }
}
