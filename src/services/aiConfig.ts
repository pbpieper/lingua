/**
 * Centralized AI backend configuration.
 *
 * Priority order:
 *   1. User override stored in localStorage (set via Settings UI)
 *   2. VITE_HUB_URL environment variable (set at build time / .env)
 *   3. Empty string — AI features disabled (graceful offline mode)
 */

const DEFAULT_HUB_URL = import.meta.env.VITE_HUB_URL || ''

export function getHubUrl(): string {
  const userOverride = localStorage.getItem('lingua-hub-url')
  if (userOverride) return userOverride
  return DEFAULT_HUB_URL
}

export function setHubUrl(url: string): void {
  if (url) {
    localStorage.setItem('lingua-hub-url', url)
  } else {
    localStorage.removeItem('lingua-hub-url')
  }
}

export function isHubConfigured(): boolean {
  return !!getHubUrl()
}

export function getHubApiUrl(path: string): string {
  const base = getHubUrl()
  if (!base) return ''
  return `${base.replace(/\/$/, '')}${path}`
}
