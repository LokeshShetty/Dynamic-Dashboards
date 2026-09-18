import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

import { CONFIG_LIMITS } from '../../_constants'
import { FORM_CONTROL_CLASS, FormRow } from './form/form-row'

type Props = {
  currentTitle: string
  onRename: (title: string) => void
  onClose: () => void
}

export function RenameDialog({ currentTitle, onRename, onClose }: Props) {
  const controlId = useId()
  const [title, setTitle] = useState(currentTitle)
  const isEmpty = title.trim() === ''

  const submit = () => {
    if (isEmpty) return
    onRename(title.trim())
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Rename widget"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="solid" disabled={isEmpty} onClick={submit}>
            Rename
          </Button>
        </>
      }
    >
      <FormRow
        label="Title"
        controlId={controlId}
        error={isEmpty ? 'a widget needs a title' : undefined}
      >
        <input
          id={controlId}
          className={FORM_CONTROL_CLASS}
          value={title}
          maxLength={CONFIG_LIMITS.MAX_TITLE_CHARS}
          onChange={(event) => setTitle(event.target.value)}
        />
      </FormRow>
    </Dialog>
  )
}
