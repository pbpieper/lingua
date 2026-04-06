import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PatchNote {
  id: string
  app_slug: string
  version: string
  title: string
  body: string
  created_at: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const APP_SLUG = 'lingua'
const LS_KEY = 'update-banner-last-seen-lingua'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getLastSeen(): string | null {
  try {
    return localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

function setLastSeen(version: string) {
  try {
    localStorage.setItem(LS_KEY, version)
  } catch {
    /* noop */
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function UpdateBanner() {
  const [notes, setNotes] = useState<PatchNote[]>([])
  const [open, setOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [visible, setVisible] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  const checkUnread = useCallback((list: PatchNote[]) => {
    if (list.length === 0) return
    const lastSeen = getLastSeen()
    setHasUnread(list[0]?.version !== lastSeen)
  }, [])

  /* Initial fetch */
  useEffect(() => {
    if (!supabase) return

    supabase
      .from('patch_notes')
      .select('*')
      .eq('app_slug', APP_SLUG)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setNotes(data as PatchNote[])
          checkUnread(data as PatchNote[])
          setVisible(true)
        }
      })
  }, [checkUnread])

  /* Realtime subscription */
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel(`patch_notes:${APP_SLUG}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patch_notes',
          filter: `app_slug=eq.${APP_SLUG}`,
        },
        (payload: any) => {
          const note = payload.new as PatchNote
          setNotes((prev) => [note, ...prev].slice(0, 10))
          setHasUnread(true)
          setVisible(true)
          toast(`New update: ${note.title}`, { icon: '✨' })
        },
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [])

  /* Mark as read */
  useEffect(() => {
    if (open && notes.length > 0) {
      setLastSeen(notes[0].version)
      setHasUnread(false)
    }
  }, [open, notes])

  /* ESC to close */
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  /* Lock scroll */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!supabase || !visible) return null

  return (
    <>
      {/* Floating pill */}
      <button
        onClick={() => setOpen(true)}
        aria-label="What's new"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full
          bg-white dark:bg-zinc-800
          px-4 py-2.5
          shadow-lg shadow-black/10 dark:shadow-black/30
          border border-zinc-200 dark:border-zinc-700
          text-sm font-medium text-zinc-700 dark:text-zinc-200
          hover:shadow-xl hover:scale-105
          active:scale-95
          transition-all duration-200 ease-out
          cursor-pointer select-none"
      >
        <svg className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 1l2.39 5.75L18 8.5l-4.3 3.83L14.78 18 10 15l-4.78 3L6.3 12.33 2 8.5l5.61-1.75L10 1z" />
        </svg>
        What&apos;s New
        {hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        )}
      </button>

      {/* Modal */}
      <div
        className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center
          transition-opacity duration-200 ease-out
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="What's new"
          className={`relative w-full max-w-lg mx-4 sm:mx-auto
            bg-white dark:bg-zinc-900
            rounded-t-2xl sm:rounded-2xl shadow-2xl
            max-h-[85vh] flex flex-col
            transition-all duration-200 ease-out
            ${open ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 1l2.39 5.75L18 8.5l-4.3 3.83L14.78 18 10 15l-4.78 3L6.3 12.33 2 8.5l5.61-1.75L10 1z" />
              </svg>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">What&apos;s New</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200
                hover:bg-zinc-100 dark:hover:bg-zinc-800
                transition-colors duration-150 cursor-pointer bg-transparent border-none"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {notes.map((note, i) => (
              <article key={note.id} className="relative">
                {i < notes.length - 1 && (
                  <div className="absolute left-[7px] top-8 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />
                )}
                <div className="flex gap-3">
                  <div className="relative mt-1.5 flex-shrink-0">
                    <div className={`h-[15px] w-[15px] rounded-full border-2
                      ${i === 0
                        ? 'bg-amber-500 border-amber-300 dark:border-amber-600'
                        : 'bg-zinc-300 dark:bg-zinc-600 border-zinc-200 dark:border-zinc-700'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold
                        bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        v{note.version}
                      </span>
                      <time className="text-xs text-zinc-400 dark:text-zinc-500">
                        {formatDate(note.created_at)}
                      </time>
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{note.title}</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed whitespace-pre-line">{note.body}</p>
                  </div>
                </div>
              </article>
            ))}
            {notes.length === 0 && (
              <p className="text-center text-sm text-zinc-400 dark:text-zinc-500 py-8">
                No updates yet. Check back soon!
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
