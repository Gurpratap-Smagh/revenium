export const MAX_U64_BIGINT = (1n << 64n) - 1n

export const parseU64 = (value: string): bigint => {
  const trimmed = value.trim()
  if (!trimmed.length) {
    throw new Error('Value is required.')
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Value must be a positive integer.')
  }

  const parsed = BigInt(trimmed)
  if (parsed > MAX_U64_BIGINT) {
    throw new Error('Value exceeds 64-bit unsigned range.')
  }
  return parsed
}
