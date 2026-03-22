import { PracticeHub } from './PracticeHub'
import { HUB_TOOL_MAP } from '@/types/tools'

export function ReadingHub() {
  return (
    <PracticeHub
      title="Reading"
      subtitle="Build comprehension through interactive reading tools"
      accentColor="blue"
      toolIds={HUB_TOOL_MAP['reading-hub']}
    />
  )
}
