import type { TaskSchedule } from './schedule'
import { addDays, parseDay, todayKey } from './schedule'

/**
 * Demo schedules, dated relative to today so the Scheduled tab always has
 * something due this week. A function, not a constant, so "today" is read
 * when the store is created.
 */
export function mockTaskSchedules(): TaskSchedule[] {
  const today = todayKey()
  const weekday = parseDay(today).getDay()
  // The coming Monday (today when today is Monday).
  const nextMonday = addDays(today, (8 - weekday) % 7)

  return [
    {
      id: 'SCH-001',
      title: 'Weekly pool cleaning',
      instructions: 'Weekly pool cleaning\nSkim, brush the walls, vacuum the floor and check the chlorine and pH. Log the readings in the note.',
      listings: ['The R Villa Merapi'],
      assignee: 'maintenance',
      assigneeType: 'role',
      priority: 'medium',
      frequency: 'weekly',
      interval: 1,
      weekdays: [1],
      startDate: nextMonday,
      end: { type: 'never' },
      leadDays: 2,
      status: 'active',
      createdAt: '2026-08-01T02:00:00Z',
      createdBy: 'Komang Juliantara',
      generated: [],
    },
    {
      id: 'SCH-002',
      title: 'AC service',
      instructions: 'AC service\nClean the filters of every split unit, check the outdoor units and top up refrigerant where needed.',
      listings: [
        '5BR Pool the R Villa Luwa – Serene near Canggu',
        'The R Pererenan Mezzanine Studio + Plunge Pool',
        'Villa Sunset Cliff',
      ],
      assignee: 'maintenance',
      assigneeType: 'role',
      priority: 'high',
      frequency: 'monthly',
      interval: 3,
      weekdays: [],
      // Within its 3-day lead time, so each listing has its task from the start.
      startDate: addDays(today, 2),
      end: { type: 'never' },
      leadDays: 3,
      status: 'active',
      createdAt: '2026-07-15T02:00:00Z',
      createdBy: 'You',
      generated: [],
    },
    {
      id: 'SCH-004',
      title: 'Morning walkthrough',
      instructions: 'Morning walkthrough\nCheck lights, AC, hot water and the pool level. Note anything that needs a repair.',
      listings: ['Villa Sunset Cliff'],
      assignee: 'housekeeping',
      assigneeType: 'role',
      priority: 'low',
      frequency: 'daily',
      interval: 1,
      weekdays: [],
      startDate: addDays(today, -14),
      end: { type: 'never' },
      leadDays: 1,
      status: 'active',
      createdAt: '2026-09-20T02:00:00Z',
      createdBy: 'Komang Juliantara',
      generated: [],
    },
    {
      id: 'SCH-003',
      title: 'Garden trim and leaf clearing',
      instructions: 'Garden trim and leaf clearing\nTrim the hedges, clear leaves from the pool deck and the gutters.',
      listings: ['Jungle Treehouse Retreat'],
      assignee: 'made-surya',
      assigneeType: 'person',
      priority: 'low',
      frequency: 'weekly',
      interval: 2,
      weekdays: [3],
      startDate: addDays(today, 4),
      end: { type: 'after', count: 12 },
      leadDays: 1,
      status: 'paused',
      createdAt: '2026-09-02T02:00:00Z',
      createdBy: 'Komang Juliantara',
      generated: [],
    },
  ]
}
