import { PracticeHub } from './PracticeHub'
import { HUB_TOOL_MAP } from '@/types/tools'

export function WritingHub() {
  return (
    <PracticeHub
      title="Writing"
      subtitle="Practice expressing yourself in your target language"
      accentColor="amber"
      toolIds={HUB_TOOL_MAP['writing-hub']}
    />
  )
}
