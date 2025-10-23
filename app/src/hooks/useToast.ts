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
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          title,
          description,
          variant,
          createdAt: Date.now(),
        },
      ])
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
