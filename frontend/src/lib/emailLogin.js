/**
 * Email + password login for every persona (teacher and participant).
 * The server picks the account role; Google and email codes are optional, not required.
 */
export async function loginWithEmailPassword(apiPost, email, password, roleHint) {
  const body = { email, password }
  if (roleHint) body.role = roleHint
  return apiPost('/auth/login/email', body)
}
