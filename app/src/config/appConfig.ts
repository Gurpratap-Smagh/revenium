import { PublicKey } from '@solana/web3.js'
import idl from '../idl/skill_stake.json'

const DEFAULT_PROGRAM_ADDRESS = 'C3e8kFFYMsEKxXwjMXix3vKSLfk9WwS1xcHeg5gedjvV'
const DEFAULT_MINT_ADDRESS = 'BbdpHzXyQmNerced3qTs6trkRB3CbpkG6B1VbXYhs7BR'

const warnedMessages = new Set<string>()

const warn = (message: string) => {
  if (typeof console !== 'undefined' && !warnedMessages.has(message)) {
    console.warn(`[SkillStake config] ${message}`)
    warnedMessages.add(message)
  }
}

const readEnv = (key: string) => {
  const value = import.meta.env[key] as string | undefined
  return value && value.length > 0 ? value : undefined
}

const getIdlMint = () => {
  const metadata = (idl as { metadata?: Record<string, unknown> }).metadata
  const maybeMint = metadata && typeof metadata['mint'] === 'string' ? (metadata['mint'] as string) : undefined
  return maybeMint
}

export const getProgramAddress = (): string => {
  const fromEnv = readEnv('VITE_SKILL_STAKE_PROGRAM_ID')
  const fromIdl = (idl as { metadata?: { address?: string } }).metadata?.address
  const resolved = fromEnv ?? fromIdl
  if (!resolved) {
    warn(
      'Program address missing. Falling back to a placeholder. Set VITE_SKILL_STAKE_PROGRAM_ID or include it in the IDL metadata.',
    )
    return DEFAULT_PROGRAM_ADDRESS
  }
  try {
    // Validate address early so downstream components do not crash.
    new PublicKey(resolved)
    return resolved
  } catch {
    warn(
      `Program address "${resolved}" is not a valid public key. Falling back to a placeholder. Update VITE_SKILL_STAKE_PROGRAM_ID with the correct address.`,
    )
    return DEFAULT_PROGRAM_ADDRESS
  }
}

export const getMintAddress = (): string => {
  const fromEnv = readEnv('VITE_SKILL_STAKE_MINT')
  const fromIdl = getIdlMint()
  const resolved = fromEnv ?? fromIdl
  if (!resolved) {
    warn(
      'Token mint missing. Falling back to a placeholder. Set VITE_SKILL_STAKE_MINT in your environment or include `mint` inside the IDL metadata.',
    )
    return DEFAULT_MINT_ADDRESS
  }
  try {
    new PublicKey(resolved)
    return resolved
  } catch {
    warn(
      `Token mint "${resolved}" is not a valid public key. Falling back to a placeholder. Update VITE_SKILL_STAKE_MINT with the correct address.`,
    )
    return DEFAULT_MINT_ADDRESS
  }
}

export const getMintPublicKey = () => new PublicKey(getMintAddress())

export const getTokenDecimals = (): number => {
  const fromEnv = readEnv('VITE_TOKEN_DECIMALS')
  const parsed = fromEnv ? Number(fromEnv) : 9
  return Number.isFinite(parsed) ? parsed : 9
}

export const getFaucetAmount = (): number => {
  const fromEnv = readEnv('VITE_FAUCET_AMOUNT')
  const parsed = fromEnv ? Number(fromEnv) : 100
  return Number.isFinite(parsed) ? parsed : 100
}
