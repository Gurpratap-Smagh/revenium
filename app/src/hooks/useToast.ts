import { useCallback } from 'react'
import { useRecoilState } from 'recoil'
import { toastState } from '../state/atoms'
import type { ToastVariant } from '../state/atoms'

interface ToastPayload {
  id?: string
  title: string
  description?: string
  variant?: ToastVariant
  ttlMs?: number
}

export const useToast = () => {
  const [toasts, setToasts] = useRecoilState(toastState)

  const pushToast = useCallback(
    ({ id, title, description, variant = 'info' }: ToastPayload) => {
      const toastId =
        id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`)
      setToasts((prev) => {
        // Deduplicate by same title+description+variant in the last 15s.
        const fifteenSecondsAgo = Date.now() - 15_000
        const exists = prev.some(
          (t) =>
            t.title === title &&
            t.description === description &&
            t.variant === variant &&
            t.createdAt >= fifteenSecondsAgo,
        )
        const next = exists
          ? prev
          : [
              ...prev,
              {
                id: toastId,
                title,
                description,
                variant,
                createdAt: Date.now(),
              },
            ]
        // Keep only the last 3 toasts.
        return next.slice(-3)
      })
      return toastId
    },
    [setToasts],
  )

  const dismissToast = useCallback(
    (toastId: string) => {
      setToasts((prev) => prev.filter((toast) => toast.id !== toastId))
    },
    [setToasts],
  )

  return { toasts, pushToast, dismissToast }
}
