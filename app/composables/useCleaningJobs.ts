import type { CleaningFilters, CleaningJob, CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import { cleanerOptions, cleaningJobs } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import { useNotifications } from '~/composables/useNotifications'

export function useCleaningJobs() {
  const jobs = useState<CleaningJob[]>('cleaning-jobs', () => cleaningJobs.value)

  const syncedJobs = computed(() => jobs.value)

  function refreshFromSeed() {
    if (!jobs.value.length) {
      jobs.value = [...cleaningJobs.value]
    }
  }

  function jobsForListing(listingId: string) {
    return syncedJobs.value
      .filter(job => job.listingId === listingId)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }

  function jobsForFilters(filters: CleaningFilters) {
    return syncedJobs.value.filter((job) => {
      if (filters.listingIds.length && !filters.listingIds.includes(job.listingId))
        return false
      if (filters.cleanerIds.length && (!job.cleanerId || !filters.cleanerIds.includes(job.cleanerId)))
        return false
      if (filters.statuses.length && !filters.statuses.includes(job.status))
        return false
      if (filters.priorities.length && !filters.priorities.includes(job.priority))
        return false
      return true
    })
  }

  function createJob(input: CleaningJobInput) {
    const job: CleaningJob = {
      ...input,
      id: `cln-${Date.now()}`,
    }
    jobs.value = [...jobs.value, job]
    return job
  }

  function updateJob(id: string, patch: Partial<CleaningJob>) {
    jobs.value = jobs.value.map(job => (job.id === id ? { ...job, ...patch } : job))
  }

  function createFromCheckout(reservation: { id: string, listingId: string, listingName: string, checkOut: string, guestName?: string }) {
    const { createGuestActivityAlert } = useNotifications()
    const scheduledAt = `${reservation.checkOut}T11:00:00+08:00`
    const job = createJob({
      listingId: reservation.listingId,
      listingName: reservation.listingName,
      scheduledAt,
      cleanerId: null,
      cleanerName: null,
      teamName: 'Housekeeping',
      status: 'draft',
      priority: 'high',
      durationMinutes: 180,
      notes: `Auto-generated from checkout ${reservation.id}.`,
      source: 'checkout',
      reservationId: reservation.id,
      recurrence: null,
    })

    createGuestActivityAlert('GUEST_CHECKED_OUT', {
      listing_id: reservation.listingId,
      listing_name: reservation.listingName,
      guest_name: reservation.guestName ?? 'Guest',
      checkout_at: scheduledAt,
      reservation_id: reservation.id,
    })

    return job
  }

  function resolveCleanerName(cleanerId: string | null) {
    if (!cleanerId)
      return null
    return cleanerOptions.find(option => option.id === cleanerId)?.name ?? null
  }

  function resolveListingName(listingId: string) {
    return listings.value.find(listing => listing.id === listingId)?.name ?? listingId
  }

  return {
    jobs,
    refreshFromSeed,
    jobsForListing,
    jobsForFilters,
    createJob,
    updateJob,
    createFromCheckout,
    resolveCleanerName,
    resolveListingName,
  }
}
