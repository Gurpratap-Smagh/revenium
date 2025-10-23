import { useEffect } from 'react'
import { useToast } from '../hooks/useToast'

const TOAST_TIMEOUT_MS = 4_500

const classByVariant = {
  success: 'toast-success',
  error: 'toast-error',
  info: 'toast-info',
} as const

export const ToastHost = () => {
  const { toasts, dismissToast } = useToast()

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), TOAST_TIMEOUT_MS),
    )
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [toasts, dismissToast])

  if (!toasts.length) {
    return null
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${classByVariant[toast.variant]}`}>
          <div className="stack stack-sm" style={{ width: '100%' }}>
            <div className="toast-title">{toast.title}</div>
            {toast.description ? <div className="toast-body">{toast.description}</div> : null}
          </div>
          <button
            aria-label="Close toast"
            className="btn btn-outline"
            style={{ padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem' }}
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
