// app/components/users/data/users.ts
import type { RoleId } from './roles'

export type PreferredLanguage = 'en' | 'de' | 'fr' | 'id' | 'es' | 'it' | 'pt' | 'nl'

export const PREFERRED_LANGUAGES: { value: PreferredLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
]

export interface User {
  id: string
  // Personal info
  name: string
  phone: string
  preferredLanguage: PreferredLanguage
  email: string
  employeeNumber: string
  // Salary (display-only in v1)
  monthlySalaryAmount: number
  workingDaysPerMonth: number
  hoursPerDay: number
  // Role + scope
  roleId: RoleId
  listingIds: string[]
  /** Platform tenant ids a cross-tenant GRO is assigned to. */
  assignedTenantIds?: string[]
  // Meta
  status: 'active' | 'inactive'
  avatarUrl?: string
  initials: string
  createdAt: string
  updatedAt: string
}

// Computes initials from a name (e.g. "Reto Wyss" → "RW")
export function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const now = new Date('2026-07-15T00:00:00Z').toISOString()

// 8 seed users — references existing staff from inbox conversations where possible
export const seedUsers: User[] = [
  {
    id: 'user-1',
    name: 'Komang Juliantara',
    phone: '+6281234567801',
    preferredLanguage: 'id',
    email: 'komang@elev8.io',
    employeeNumber: 'EMP-001',
    monthlySalaryAmount: 8500000,
    workingDaysPerMonth: 26,
    hoursPerDay: 8,
    roleId: 'role-guest-experience-manager',
    listingIds: ['lst-1', 'lst-2', 'lst-3', 'lst-4'],
    status: 'active',
    initials: 'KJ',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-2',
    name: 'Made Surya',
    phone: '+6281234567802',
    preferredLanguage: 'id',
    email: 'made.surya@elev8.io',
    employeeNumber: 'EMP-002',
    monthlySalaryAmount: 9000000,
    workingDaysPerMonth: 26,
    hoursPerDay: 8,
    roleId: 'role-listing-manager',
    listingIds: ['lst-1', 'lst-2', 'lst-5', 'lst-6', 'lst-7', 'lst-8'],
    status: 'active',
    initials: 'MS',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-3',
    name: 'Wayan Adi',
    phone: '+6281234567803',
    preferredLanguage: 'id',
    email: 'wayan.adi@elev8.io',
    employeeNumber: 'EMP-003',
    monthlySalaryAmount: 9000000,
    workingDaysPerMonth: 26,
    hoursPerDay: 8,
    roleId: 'role-listing-manager',
    listingIds: ['lst-3', 'lst-4', 'lst-9', 'lst-10'],
    status: 'active',
    initials: 'WA',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-4',
    name: 'Reto Wyss Test',
    phone: '+41768165541',
    preferredLanguage: 'de',
    email: 'reto@iwyss.ch',
    employeeNumber: 'EMP-004',
    monthlySalaryAmount: 0,
    workingDaysPerMonth: 0,
    hoursPerDay: 0,
    roleId: 'role-owner',
    listingIds: [],
    status: 'active',
    initials: 'RW',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-5',
    name: 'Made Wirawan',
    phone: '+6281234567805',
    preferredLanguage: 'id',
    email: 'made.wirawan@elev8.io',
    employeeNumber: 'EMP-005',
    monthlySalaryAmount: 12000000,
    workingDaysPerMonth: 26,
    hoursPerDay: 9,
    roleId: 'role-general-manager',
    listingIds: [],
    status: 'active',
    initials: 'MW',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-6',
    name: 'Ni Putu Sari',
    phone: '+6281234567806',
    preferredLanguage: 'id',
    email: 'putu.sari@elev8.io',
    employeeNumber: 'EMP-006',
    monthlySalaryAmount: 7500000,
    workingDaysPerMonth: 26,
    hoursPerDay: 8,
    roleId: 'role-housekeeping-manager',
    listingIds: ['lst-1', 'lst-2', 'lst-3', 'lst-4', 'lst-5'],
    status: 'active',
    initials: 'NP',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-7',
    name: 'Ketut Antara',
    phone: '+6281234567807',
    preferredLanguage: 'id',
    email: 'ketut.antara@elev8.io',
    employeeNumber: 'EMP-007',
    monthlySalaryAmount: 5500000,
    workingDaysPerMonth: 26,
    hoursPerDay: 8,
    roleId: 'role-housekeeping',
    listingIds: ['lst-1', 'lst-2'],
    status: 'active',
    initials: 'KA',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-9',
    name: 'GRO Support',
    phone: '+6281234567809',
    preferredLanguage: 'id',
    email: 'gro@elev8.io',
    employeeNumber: 'EMP-009',
    monthlySalaryAmount: 0,
    workingDaysPerMonth: 0,
    hoursPerDay: 0,
    roleId: 'role-gro',
    listingIds: [],
    assignedTenantIds: ['t-1', 't-2', 't-3'],
    status: 'active',
    initials: 'GS',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'user-8',
    name: 'Gede Pratama',
    phone: '+6281234567808',
    preferredLanguage: 'id',
    email: 'gede.pratama@elev8.io',
    employeeNumber: 'EMP-008',
    monthlySalaryAmount: 6000000,
    workingDaysPerMonth: 26,
    hoursPerDay: 8,
    roleId: 'role-pool',
    listingIds: ['lst-1', 'lst-3', 'lst-5'],
    status: 'inactive',
    initials: 'GP',
    createdAt: now,
    updatedAt: now,
  },
]