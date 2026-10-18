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
    iconName: 'lucide:circle-dashed',
    iconClass: 'text-muted-foreground',
    icon: h(Icon, { name: 'lucide:circle-dashed', class: 'text-muted-foreground' }),
  },
  {
    value: 'in progress',
    label: 'In progress',
    iconName: 'lucide:timer',
    iconClass: 'text-amber-500',
    icon: h(Icon, { name: 'lucide:timer', class: 'text-amber-500' }),
  },
  {
    value: 'completed',
    label: 'Completed',
    iconName: 'lucide:circle-check',
    iconClass: 'text-green-500',
    icon: h(Icon, { name: 'lucide:circle-check', class: 'text-green-500' }),
  },
]

export const priorities = [
  {
    value: 'low',
    label: 'Low',
    iconClass: 'text-green-500',
    icon: h(Icon, { name: 'lucide:flag', class: 'text-green-500' }),
  },
  {
    value: 'medium',
    label: 'Medium',
    iconClass: 'text-blue-500',
    icon: h(Icon, { name: 'lucide:flag', class: 'text-blue-500' }),
  },
  {
    value: 'high',
    label: 'High',
    iconClass: 'text-red-500',
    icon: h(Icon, { name: 'lucide:flag', class: 'text-red-500' }),
  },
]
