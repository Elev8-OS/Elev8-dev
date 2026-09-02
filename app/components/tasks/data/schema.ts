import { z } from 'zod'

export const statusUpdateSchema = z.object({
  date: z.string(),
  note: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  images: z.array(z.string()).optional(),
  /** Who did this. Drives the avatar and the bold name in the timeline. */
  actor: z.object({
    name: z.string(),
    kind: z.enum(['staff', 'owner', 'system']).optional(),
  }).optional(),
  /**
   * Render an icon instead of initials — for entries that are about a thing
   * rather than a person (a receipt added, a file attached).
   */
  icon: z.string().optional(),
  /**
   * Cost recorded at this point in the task's history, with the receipt it
   * came from. Rendered as a card in the timeline.
   */
  cost: z.object({
    amount: z.number(),
    currency: z.string().optional(),
    /** The quote this is being measured against, when there was one. */
    quoted: z.number().optional(),
    receipt: z.object({
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
    }).optional(),
  }).optional(),
})

export type StatusUpdate = z.infer<typeof statusUpdateSchema>

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  assignee: z.string().optional(),
  assigneeType: z.enum(['role', 'person']).optional(),
  priority: z.string(),
  listing: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  images: z.array(z.string()).optional(),
  statusUpdates: z.array(statusUpdateSchema).optional(),
  createdAt: z.string().optional(),
  linkedInventoryItemId: z.string().optional(),
  linkedInventoryItemName: z.string().optional(),
  linkedInventoryEntryId: z.string().optional(),
  conditionBefore: z.string().optional(),
  detectedByHostBuddy: z.boolean().optional(),
  /** Where the task came from. Defaults to 'manual' for ad-hoc entries. */
  source: z.enum(['manual', 'from_finding']).optional(),
  /** When source === 'from_finding', the id of the originating finding. */
  sourceRef: z.string().optional(),
  /** Owner-related maintenance task (PRD 5.4.3) — the linked owner id. */
  ownerId: z.string().optional(),
  /** True when this task is visible to the owner in their portal (read-only). */
  ownerVisible: z.boolean().optional(),
  /** Final invoice amount after the repair completes (feeds the statement). */
  finalInvoiceAmount: z.number().optional(),
  /**
   * Owner cost approval. When `ownerApprovalRequired` is true the task cannot
   * be started until the owner approves — see `useTaskOwnerApproval`.
   */
  ownerApprovalRequired: z.boolean().optional(),
  ownerApprovalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  ownerApprovalNote: z.string().optional(),
  ownerApprovalDecidedAt: z.string().optional(),
  /** Quoted cost shown to the owner when asking for approval. */
  estimatedCost: z.number().optional(),
  /** Receipt uploaded on completion; its amount becomes `finalInvoiceAmount`. */
  receipt: z.object({
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
    uploadedAt: z.string(),
  }).optional(),
})

export type Task = z.infer<typeof taskSchema>
