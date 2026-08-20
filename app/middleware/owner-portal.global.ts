export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/owner-portal'))
    return
  if (to.path === '/owner-portal/login')
    return
  // PRD 5.3 — the contract e-sign page must be reachable without a session:
  // the owner lands here after the magic link, signs, and THEN gets access.
  if (to.path === '/owner-portal/contract')
    return

  const { isAuthenticated } = useOwnerAuth()
  if (!isAuthenticated.value)
    return navigateTo('/owner-portal/login')
})
