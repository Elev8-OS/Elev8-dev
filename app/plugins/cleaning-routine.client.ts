import { listings } from '~/components/listings/data/listings'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCleaningScheduleDefault } from '~/composables/useCleaningScheduleDefault'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'
import { useReservationsModule } from '~/composables/useReservationsModule'

/**
 * Keeps the daily routine (`useCleaningJobs().syncRoutineCleanings`) in step:
 * once on load, whenever bookings, listings, the company schedule or the
 * checklists change, and hourly so the window rolls forward at midnight.
 * The sync only writes cleaning jobs, which are not watched, so it cannot loop.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const { syncRoutineCleanings } = useCleaningJobs()
    const { reservations } = useReservationsModule()
    const { companyDefault } = useCleaningScheduleDefault()
    const { typeDefaults, templates } = useCleaningStepTemplates()

    watch([reservations, listings, companyDefault, typeDefaults, templates], () => syncRoutineCleanings(), { immediate: true })
    setInterval(() => syncRoutineCleanings(), 60 * 60 * 1000)
  })
})
