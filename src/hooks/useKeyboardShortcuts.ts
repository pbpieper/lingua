import { useEffect, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { TOOLS } from '@/types/tools'

export function useKeyboardShortcuts() {
  const { setActiveTool } = useApp()
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // ? toggles shortcuts modal
      if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
        return
      }

      // Alt+number: navigate to tool by position
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= 9 && num <= TOOLS.length) {
          e.preventDefault()
          setActiveTool(TOOLS[num - 1].id)
          return
        }

        // Alt+letter shortcuts
        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault()
            setActiveTool('home')
            break
          case 'f':
            e.preventDefault()
            setActiveTool('flashcards')
            break
          case 'u':
            e.preventDefault()
            setActiveTool('upload')
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTool])

  return { showShortcuts, setShowShortcuts }
}
