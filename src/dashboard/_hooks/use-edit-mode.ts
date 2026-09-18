import { createParser, useQueryState } from 'nuqs'

/** Edit mode is a parameter on the dashboard, not a separate screen: /d/demo?edit=1 */
const parseEditFlag = createParser({
  parse: (raw) => raw === '1' || raw === 'true',
  serialize: (value: boolean) => (value ? '1' : '0'),
})

export function useEditMode() {
  const [isEditing, setIsEditing] = useQueryState(
    'edit',
    parseEditFlag.withOptions({ history: 'push' }).withDefault(false),
  )

  return {
    isEditing,
    enterEditMode: () => {
      void setIsEditing(true)
    },
    leaveEditMode: () => {
      void setIsEditing(null)
    },
  }
}
