export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/owner-portal'))
    return
  if (to.path === '/owner-portal/login')
    return

  const { isAuthenticated } = useOwnerAuth()
  if (!isAuthenticated.value)
    return navigateTo('/owner-portal/login')
})
