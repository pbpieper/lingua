import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UserProfile {
  id: string
  email: string | null
  displayName: string
  nativeLanguage: string
  learningLanguages: string[]
  avatarUrl: string | null
  createdAt: string
}

interface AuthContextValue {
  /** Current user profile (Supabase-backed or anonymous localStorage user) */
  user: UserProfile | null
  /** Whether a Supabase session is active */
  isAuthenticated: boolean
  /** True while checking initial session on mount */
  loading: boolean
  /** Last auth error message */
  error: string | null

  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
  /** Update profile fields (persisted to Supabase if authenticated, otherwise localStorage) */
  updateProfile: (patch: Partial<Pick<UserProfile, 'displayName' | 'nativeLanguage' | 'learningLanguages' | 'avatarUrl'>>) => Promise<void>
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ANON_PROFILE_KEY = 'lingua-anon-profile'

function getAnonUserId(): string {
  const stored = localStorage.getItem('lingua-user-id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('lingua-user-id', id)
  return id
}

function loadAnonProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(ANON_PROFILE_KEY)
    if (raw) return JSON.parse(raw) as UserProfile
  } catch { /* ignore */ }

  const onboarding = (() => {
    try {
      const r = localStorage.getItem('lingua-onboarding')
      return r ? JSON.parse(r) : null
    } catch { return null }
  })()

  const prefs = (() => {
    try {
      const r = localStorage.getItem('lingua-preferences')
      return r ? JSON.parse(r) : null
    } catch { return null }
  })()

  return {
    id: getAnonUserId(),
    email: null,
    displayName: prefs?.userName || '',
    nativeLanguage: onboarding?.nativeLanguage || '',
    learningLanguages: onboarding?.targetLanguage ? [onboarding.targetLanguage] : [],
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  }
}

function saveAnonProfile(profile: UserProfile): void {
  localStorage.setItem(ANON_PROFILE_KEY, JSON.stringify(profile))
}

function supabaseUserToProfile(user: SupabaseUser): UserProfile {
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: meta.display_name || meta.full_name || meta.name || '',
    nativeLanguage: meta.native_language || '',
    learningLanguages: meta.learning_languages || [],
    avatarUrl: meta.avatar_url || null,
    createdAt: user.created_at,
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const AuthCtx = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  /* ---------- initial session check ---------- */
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      // No Supabase configured — use anonymous mode
      setUser(loadAnonProfile())
      setIsAuthenticated(false)
      setLoading(false)
      return
    }

    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(supabaseUserToProfile(session.user))
        setIsAuthenticated(true)
      } else {
        setUser(loadAnonProfile())
        setIsAuthenticated(false)
      }
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (session?.user) {
          setUser(supabaseUserToProfile(session.user))
          setIsAuthenticated(true)
        } else {
          setUser(loadAnonProfile())
          setIsAuthenticated(false)
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  /* ---------- signIn ---------- */
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
  }, [])

  /* ---------- signUp ---------- */
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (!supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }
    setError(null)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })
    if (err) setError(err.message)
  }, [])

  /* ---------- signInWithGoogle ---------- */
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (err) setError(err.message)
  }, [])

  /* ---------- signOut ---------- */
  const signOut = useCallback(async () => {
    if (!supabase) return
    setError(null)
    const { error: err } = await supabase.auth.signOut()
    if (err) setError(err.message)
  }, [])

  /* ---------- updateProfile ---------- */
  const updateProfile = useCallback(async (
    patch: Partial<Pick<UserProfile, 'displayName' | 'nativeLanguage' | 'learningLanguages' | 'avatarUrl'>>,
  ) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, ...patch }

      if (isAuthenticated && supabase) {
        // Persist to Supabase user metadata
        supabase.auth.updateUser({
          data: {
            display_name: updated.displayName,
            native_language: updated.nativeLanguage,
            learning_languages: updated.learningLanguages,
            avatar_url: updated.avatarUrl,
          },
        }).catch(() => { /* silently fail */ })
      } else {
        saveAnonProfile(updated)
      }

      return updated
    })
  }, [isAuthenticated])

  return (
    <AuthCtx.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        error,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        clearError,
        updateProfile,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}
