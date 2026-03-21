// Tool variables & variations framework
// Variables = per-tool settings (difficulty, size, direction, hints)
// Variations = different modes of the same tool (memory vs column match)

export interface ToolVariable {
  key: string
  label: string
  type: 'select' | 'toggle' | 'slider'
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
  default: string | number | boolean
}

export interface ToolVariation {
  key: string
  label: string
  description: string
  icon?: string
}

export interface ToolConfig<V extends Record<string, unknown> = Record<string, unknown>> {
  toolId: string
  variations: ToolVariation[]
  variables: ToolVariable[]
  activeVariation: string
  activeVariables: V
}

// Persistence helpers
const STORAGE_PREFIX = 'lingua-tool-config-'

export function loadToolConfig<V extends Record<string, unknown>>(
  toolId: string,
  defaults: { variation: string; variables: V },
): { activeVariation: string; activeVariables: V } {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${toolId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        activeVariation: parsed.activeVariation ?? defaults.variation,
        activeVariables: { ...defaults.variables, ...parsed.activeVariables },
      }
    }
  } catch {}
  return { activeVariation: defaults.variation, activeVariables: defaults.variables }
}

export function saveToolConfig(
  toolId: string,
  activeVariation: string,
  activeVariables: Record<string, unknown>,
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${toolId}`,
      JSON.stringify({ activeVariation, activeVariables }),
    )
  } catch {}
}
