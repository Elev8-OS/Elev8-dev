export interface PendingSignup {
  name: string
  email: string
}

/**
 * Code the mock OTP screen accepts. Mirrors the demo credentials that
 * `AuthSignIn` prefills. There is no auth backend yet.
 */
export const MOCK_OTP_CODE = '123456'

export function useAuthSignup() {
  const pendingSignup = useState<PendingSignup | null>('auth-pending-signup', () => null)

  function startSignup(payload: PendingSignup) {
    pendingSignup.value = { ...payload }
  }

  function completeSignup() {
    pendingSignup.value = null
  }

  function verifyCode(code: string) {
    return code === MOCK_OTP_CODE
  }

  return {
    pendingSignup,
    startSignup,
    completeSignup,
    verifyCode,
  }
}
