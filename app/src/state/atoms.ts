import { atom } from 'recoil'

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  createdAt: number
}

export const toastState = atom<ToastMessage[]>({
  key: 'toastState',
  default: [],
})

export const stakeAmountState = atom<string>({
  key: 'stakeAmountState',
  default: '',
})

export const tokenBalanceState = atom<number>({
  key: 'tokenBalanceState',
  default: 0,
})

export const totalStakedState = atom<number>({
  key: 'totalStakedState',
  default: 0,
})

export const pendingRewardsState = atom<number>({
  key: 'pendingRewardsState',
  default: 0,
})

export const loadingState = atom<boolean>({
  key: 'loadingState',
  default: false,
})

export const aprBpsState = atom<number>({
  key: 'aprBpsState',
  default: 0,
})

export const faucetCapState = atom<number>({
  key: 'faucetCapState',
  default: 0,
})

export const powDifficultyState = atom<number>({
  key: 'powDifficultyState',
  default: 0,
})

export const powRewardState = atom<number>({
  key: 'powRewardState',
  default: 0,
})

export const oracleAuthorityState = atom<string | null>({
  key: 'oracleAuthorityState',
  default: null,
})

export const oracleNonceState = atom<number>({
  key: 'oracleNonceState',
  default: 0,
})

export const faucetClaimedState = atom<number>({
  key: 'faucetClaimedState',
  default: 0,
})
