import { PracticeHub } from './PracticeHub'
import { HUB_TOOL_MAP } from '@/types/tools'

export function SpeakingHub() {
  return (
    <PracticeHub
      title="Speaking"
      subtitle="Improve pronunciation and conversational fluency"
      accentColor="rose"
      toolIds={HUB_TOOL_MAP['speaking-hub']}
    />
  )
}
