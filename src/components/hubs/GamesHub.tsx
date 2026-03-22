import { PracticeHub } from './PracticeHub'
import { HUB_TOOL_MAP } from '@/types/tools'

export function GamesHub() {
  return (
    <PracticeHub
      title="Games"
      subtitle="Reinforce vocabulary through fun, fast-paced exercises"
      accentColor="purple"
      toolIds={HUB_TOOL_MAP['games-hub']}
    />
  )
}
