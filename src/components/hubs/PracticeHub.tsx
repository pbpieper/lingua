import { useApp } from '@/context/AppContext'
import { TOOLS } from '@/types/tools'
import type { LinguaToolId } from '@/types/tools'

interface HubCard {
  id: LinguaToolId
  icon: string
  label: string
  description: string
}

export function PracticeHub({
  title,
  subtitle,
  toolIds,
}: {
  title: string
  subtitle: string
  accentColor?: string
  toolIds: LinguaToolId[]
}) {
  const { setActiveTool } = useApp()

  const cards: HubCard[] = toolIds
    .map(id => {
      const def = TOOLS.find(t => t.id === id)
      if (!def) return null
      return { id: def.id, icon: def.icon, label: def.label, description: def.description }
    })
    .filter(Boolean) as HubCard[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{subtitle}</p>
      </div>

      {/* Tool cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => setActiveTool(card.id)}
            className="flex flex-col items-start gap-2 rounded-xl px-5 py-4 text-left cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:shadow-sm"
          >
            <span className="text-2xl">{card.icon}</span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{card.label}</span>
            <span className="text-xs text-[var(--color-text-muted)] leading-relaxed">{card.description}</span>
          </button>
        ))}
      </div>

      {/* Back link */}
      <button
        onClick={() => setActiveTool('home')}
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary-main)] cursor-pointer border-none bg-transparent transition-colors"
      >
        &larr; Back to Home
      </button>
    </div>
  )
}
