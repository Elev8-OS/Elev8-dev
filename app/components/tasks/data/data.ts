import { Icon } from '#components'
import { h } from 'vue'

export const assigneeRoles = [
  { value: 'admin', label: 'Admin' },
  { value: 'guest-relations', label: 'Guest Relations' },
  { value: 'listing-manager', label: 'Listing Manager' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'maintenance', label: 'Maintenance' },
]

export const staffMembers = [
  { value: 'komang-juliantara', label: 'Komang Juliantara', role: 'guest-relations' },
  { value: 'made-surya', label: 'Made Surya', role: 'listing-manager' },
  { value: 'wayan-adi', label: 'Wayan Adi', role: 'listing-manager' },
  { value: 'you', label: 'You', role: 'admin' },
]

export const assigneeOptions = [
  ...assigneeRoles.map(r => ({ value: r.value, label: r.label, type: 'role' as const })),
  ...staffMembers.map(s => ({ value: s.value, label: s.label, type: 'person' as const })),
]

/** The three task statuses (see `TASK_STATUSES`), with the icon each shows. */
export const statuses = [
  {
    value: 'not started',
    label: 'Not started',
    icon: h(Icon, { name: 'i-radix-icons-circle' }),
  },
  {
    value: 'in progress',
    label: 'In progress',
    icon: h(Icon, { name: 'i-radix-icons-stopwatch' }),
  },
  {
    value: 'completed',
    label: 'Completed',
    icon: h(Icon, { name: 'i-radix-icons-check-circled' }),
  },
]

export const priorities = [
  {
    value: 'low',
    label: 'Low',
    icon: h(Icon, { name: 'i-radix-icons-arrow-down' }),
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: h(Icon, { name: 'i-radix-icons-arrow-right' }),
  },
  {
    value: 'high',
    label: 'High',
    icon: h(Icon, { name: 'i-radix-icons-arrow-up' }),
  },
]
