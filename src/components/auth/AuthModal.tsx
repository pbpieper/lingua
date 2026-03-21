import { useState, useCallback, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured } from '@/services/supabase'
import { syncFromCloud } from '@/services/dataSync'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

type Tab = 'signin' | 'signup'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { signIn, signUp, signInWithGoogle, error, clearError, user } = useAuth()

  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
    setLocalError(null)
    setSuccessMsg(null)
    clearError()
  }, [clearError])

  const switchTab = useCallback((t: Tab) => {
    setTab(t)
    resetForm()
  }, [resetForm])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [onClose, resetForm])

  /* ---------- submit ---------- */
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setSuccessMsg(null)
    clearError()

    if (!isSupabaseConfigured()) {
      setLocalError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
      return
    }

    if (!email || !password) {
      setLocalError('Email and password are required.')
      return
    }

    if (tab === 'signup') {
      if (!displayName.trim()) {
        setLocalError('Display name is required.')
        return
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.')
        return
      }
    }

    setLoading(true)
    try {
      if (tab === 'signin') {
        await signIn(email, password)
        // After sign-in, sync data from cloud
        if (user?.id) {
          await syncFromCloud(user.id).catch(() => {})
        }
      } else {
        await signUp(email, password, displayName.trim())
        setSuccessMsg('Check your email to confirm your account, then sign in.')
      }
      // If no error was set by the auth context, close the modal (for sign-in)
      if (tab === 'signin') {
        // Give a brief moment for the auth state to propagate
        setTimeout(() => {
          handleClose()
        }, 300)
      }
    } finally {
      setLoading(false)
    }
  }, [email, password, confirmPassword, displayName, tab, signIn, signUp, clearError, user?.id, handleClose])

  const handleGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLocalError('Supabase is not configured.')
      return
    }
    setLoading(true)
    try {
      await signInWithGoogle()
    } finally {
      setLoading(false)
    }
  }, [signInWithGoogle])

  if (!open) return null

  const displayError = localError || error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full
            text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
          aria-label="Close"
        >
          &#10005;
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Welcome to Lingua
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Sign in to sync your vocabulary across devices
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          <button
            onClick={() => switchTab('signin')}
            className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer
              ${tab === 'signin'
                ? 'text-[var(--color-primary-main)] border-b-2 border-[var(--color-primary-main)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchTab('signup')}
            className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer
              ${tab === 'signup'
                ? 'text-[var(--color-primary-main)] border-b-2 border-[var(--color-primary-main)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Success message */}
          {successMsg && (
            <div className="rounded-lg px-4 py-3 text-sm bg-green-50 text-green-800 border border-green-200">
              {successMsg}
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
              {displayError}
            </div>
          )}

          {/* Display Name (signup only) */}
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
                  placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)]
                bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
                placeholder:text-[var(--color-text-muted)]"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'At least 6 characters' : 'Your password'}
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)]
                bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
                placeholder:text-[var(--color-text-muted)]"
            />
          </div>

          {/* Confirm password (signup only) */}
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-bg)] text-[var(--color-text-primary)] text-sm
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-main)]
                  placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer
              bg-[var(--color-primary-main)] text-white hover:opacity-90 transition-opacity
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? 'Please wait...'
              : tab === 'signin'
                ? 'Sign In'
                : 'Create Account'
            }
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-muted)]">or</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium cursor-pointer
              border border-[var(--color-border)] text-[var(--color-text-primary)]
              bg-[var(--color-bg)] hover:bg-[var(--color-surface-alt)] transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.92a8.78 8.78 0 002.68-6.62z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.99 8.99 0 009 18z" fill="#34A853" />
              <path d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.96H.96A8.99 8.99 0 000 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" fill="#FBBC05" />
              <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.99 8.99 0 00.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            {tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
          </button>

          {/* Forgot password link (sign in only) */}
          {tab === 'signin' && (
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              <button
                type="button"
                className="text-[var(--color-primary-main)] hover:underline cursor-pointer bg-transparent border-none"
                onClick={() => {
                  // In a full implementation this would trigger password reset
                  setLocalError('Password reset is not yet implemented. Contact support for help.')
                }}
              >
                Forgot your password?
              </button>
            </p>
          )}
        </form>

        {/* Footer info */}
        <div className="px-6 pb-5">
          <p className="text-[10px] text-center text-[var(--color-text-muted)] leading-relaxed">
            Your data stays on your device until you sign in.
            Signing in enables cloud sync across devices.
          </p>
        </div>
      </div>
    </div>
  )
}
