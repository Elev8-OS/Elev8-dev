import type { ForwardedRef } from '~/components/inbox/data/internal'

/**
 * The right-click actions a message offers, wherever it lives. Both the guest
 * thread and an internal room raise the same two dialogs, so the drafts live
 * here and the dialogs are mounted once in `inbox/Layout.vue` rather than once
 * per message.
 */

export interface ForwardRequest {
  refs: ForwardedRef[]
  /** Room the forward came from; never offered as its own target. */
  excludeRoomId?: string
  /** Listing whose rooms the picker opens on, when one is known. */
  preferListingId?: string
}

export interface TaskRequest {
  refs: ForwardedRef[]
  /** Listing NAME, which is what `Task.listing` stores. */
  listingName?: string
  /** Room to post the "task opened" notice into, when started from a room. */
  roomId?: string
  /** Pre-selected assignee, from the room's role. */
  assignee?: string
}

export function useMessageActions() {
  const forwardRequest = useState<ForwardRequest | null>('inbox-forward-request', () => null)
  const taskRequest = useState<TaskRequest | null>('inbox-task-request', () => null)

  const forwardOpen = computed({
    get: () => forwardRequest.value !== null,
    set: (open: boolean) => {
      if (!open)
        forwardRequest.value = null
    },
  })

  const taskOpen = computed({
    get: () => taskRequest.value !== null,
    set: (open: boolean) => {
      if (!open)
        taskRequest.value = null
    },
  })

  function openForward(request: ForwardRequest) {
    if (request.refs.length === 0)
      return
    forwardRequest.value = request
  }

  function closeForward() {
    forwardRequest.value = null
  }

  function openTask(request: TaskRequest) {
    if (request.refs.length === 0)
      return
    taskRequest.value = request
  }

  function closeTask() {
    taskRequest.value = null
  }

  return {
    forwardRequest,
    taskRequest,
    forwardOpen,
    taskOpen,
    openForward,
    closeForward,
    openTask,
    closeTask,
  }
}
