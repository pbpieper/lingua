import type { ToolVariable, ToolVariation } from '@/types/toolConfig'

interface ToolOptionsBarProps {
  variations: ToolVariation[]
  variables: ToolVariable[]
  activeVariation: string
  activeVariables: Record<string, unknown>
  onVariationChange: (key: string) => void
  onVariableChange: (key: string, value: unknown) => void
}

export function ToolOptionsBar({
  variations,
  variables,
  activeVariation,
  activeVariables,
  onVariationChange,
  onVariableChange,
}: ToolOptionsBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl"
      style={{
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Variation pills */}
      {variations.length > 1 && (
        <div className="flex items-center gap-1.5">
          {variations.map(v => (
            <button
              key={v.key}
              onClick={() => onVariationChange(v.key)}
              title={v.description}
              className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: activeVariation === v.key
                  ? 'var(--color-primary-main)'
                  : 'transparent',
                color: activeVariation === v.key
                  ? '#fff'
                  : 'var(--color-text-secondary)',
                border: activeVariation === v.key
                  ? 'none'
                  : '1px solid var(--color-border)',
              }}
            >
              {v.icon && <span className="mr-1">{v.icon}</span>}
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Separator */}
      {variations.length > 1 && variables.length > 0 && (
        <div
          className="w-px h-5"
          style={{ background: 'var(--color-border)' }}
        />
      )}

      {/* Variable controls */}
      {variables.map(v => {
        const value = activeVariables[v.key] ?? v.default

        if (v.type === 'toggle') {
          return (
            <label
              key={v.key}
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {v.label}
              </span>
              <button
                onClick={() => onVariableChange(v.key, !value)}
                className="relative w-8 h-4.5 rounded-full transition-colors cursor-pointer"
                style={{
                  background: value
                    ? 'var(--color-primary-main)'
                    : 'var(--color-border)',
                  border: 'none',
                  padding: 0,
                  width: 32,
                  height: 18,
                }}
              >
                <span
                  className="absolute top-0.5 rounded-full bg-white transition-all"
                  style={{
                    width: 14,
                    height: 14,
                    left: value ? 15 : 3,
                  }}
                />
              </button>
            </label>
          )
        }

        if (v.type === 'select' && v.options) {
          return (
            <label
              key={v.key}
              className="flex items-center gap-1.5"
            >
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {v.label}
              </span>
              <select
                value={String(value)}
                onChange={e => {
                  const numVal = Number(e.target.value)
                  onVariableChange(v.key, isNaN(numVal) ? e.target.value : numVal)
                }}
                className="px-2 py-1 rounded-lg text-xs outline-none cursor-pointer"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {v.options.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )
        }

        return null
      })}
    </div>
  )
}
