import { useEffect } from 'react'
import { TOOLS } from '@/types/tools'

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
}

function KeyBadge({ children }: { children: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded border font-mono text-xs
        bg-[var(--color-surface-alt)] border-[var(--color-border)]
        text-[var(--color-text-primary)]"
    >
      {children}
    </span>
  )
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  ...TOOLS.slice(0, 9).map((t, i) => ({
    keys: [`Alt+${i + 1}`],
    label: t.label,
  })),
  { keys: ['Alt+H'], label: 'Home' },
  { keys: ['Alt+F'], label: 'Flashcards' },
  { keys: ['Alt+U'], label: 'Upload' },
  { keys: ['?'], label: 'Toggle this help' },
]

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl
          max-w-md w-full mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label + keys.join(',')} className="flex items-center justify-between py-1">
              <span className="flex gap-1">
                {keys.map(k => (
                  <KeyBadge key={k}>{k}</KeyBadge>
                ))}
              </span>
              <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          Shortcuts are disabled when typing in an input field.
        </p>
      </div>
    </div>
  )
}
