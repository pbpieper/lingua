import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeContext { isDark: boolean; toggle: () => void }

const ThemeCtx = createContext<ThemeContext>({ isDark: false, toggle: () => {} })

export function useTheme() { return useContext(ThemeCtx) }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setDark] = useState(() => {
    const stored = localStorage.getItem('lingua-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('lingua-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <ThemeCtx.Provider value={{ isDark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeCtx.Provider>
  )
}
