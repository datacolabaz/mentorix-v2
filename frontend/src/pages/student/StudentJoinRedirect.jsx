import { Navigate, useSearchParams } from 'react-router-dom'
import { parseJoinInviteInput } from '../../lib/joinInvite'

/** Köhnə /student/join — birbaşa /join/CODE linkinə yönləndirir. */
export default function StudentJoinRedirect() {
  const [searchParams] = useSearchParams()
  const code = parseJoinInviteInput(
    searchParams.get('link') || searchParams.get('url') || searchParams.get('code') || '',
  )
  if (code) return <Navigate to={`/join/${encodeURIComponent(code)}`} replace />
  return <Navigate to="/student/groups" replace />
}
