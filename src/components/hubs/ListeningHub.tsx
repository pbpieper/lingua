import { PracticeHub } from './PracticeHub'
import { HUB_TOOL_MAP } from '@/types/tools'

export function ListeningHub() {
  return (
    <PracticeHub
      title="Listening"
      subtitle="Train your ear to understand spoken language"
      accentColor="teal"
      toolIds={HUB_TOOL_MAP['listening-hub']}
    />
  )
}
