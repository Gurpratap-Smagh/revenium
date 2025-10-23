import { BN } from '@coral-xyz/anchor'

export const toBaseUnits = (amount: string, decimals: number) => {
  const sanitized = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(sanitized)) {
    throw new Error('Enter a numeric amount')
  }
  const [whole, fraction = ''] = sanitized.split('.')
  const base = BigInt(10) ** BigInt(decimals)
  const wholeUnits = BigInt(whole || '0') * base
  const fractionDigits = fraction.padEnd(decimals, '0').slice(0, decimals)
  const fractionUnits = fractionDigits.length ? BigInt(fractionDigits) : 0n
  return new BN((wholeUnits + fractionUnits).toString())
}

export const fromBaseUnits = (raw: bigint, decimals: number) => {
  if (decimals === 0) {
    return Number(raw)
  }
  const divisor = BigInt(10) ** BigInt(decimals)
  const whole = raw / divisor
  const remainder = raw % divisor
  const fractional = remainder.toString().padStart(decimals, '0').replace(/0+$/, '')
  return Number(`${whole}${fractional ? `.${fractional}` : ''}`)
}
