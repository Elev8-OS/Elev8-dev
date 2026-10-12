/**
 * Schedules make their due tasks as soon as the app loads, not only when
 * /tasks is opened, so the Operations Calendar, the Cockpit and the inbox see
 * them too. Re-checked hourly for a tab left open past midnight.
 *
 * ⚠️ `onNuxtReady`, not plugin time or `app:mounted`: the layout is async, so
 * both run before the page hydrates, and tasks added then make the client's
 * task list differ from the server render.
 */
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const { generateDueTasks } = useTaskSchedules()
    generateDueTasks()
    setInterval(() => generateDueTasks(), 60 * 60 * 1000)
  })
})
