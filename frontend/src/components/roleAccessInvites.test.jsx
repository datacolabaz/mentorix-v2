import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const toast = vi.fn()
vi.mock('./common/Toast', () => ({ useToast: () => toast }))
vi.mock('../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import api from '../lib/api'
import useAuthStore from '../hooks/useAuth'
import WorkspaceSwitcher from './common/WorkspaceSwitcher'
import GroupInvitesModal, { bakuLocalToIso } from './instructor/GroupInvitesModal'
import LessonFollowups from './live/LessonFollowups'
import RoleRequestsReview from '../pages/common/RoleRequestsReview'
import ParentResults from '../pages/parent/Results'
import { accessRolesOf, canReviewRoleRequests } from '../lib/roleAccess'

const student = {
  id: 'u1',
  full_name: 'Aysel',
  role: 'student',
  access_roles: ['student'],
  teacher_request: null,
}

function withRouter(node) {
  return <MemoryRouter>{node}</MemoryRouter>
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: student, token: 't' })
})

describe('role access helpers', () => {
  it('uses server access_roles and falls back for old sessions', () => {
    expect(accessRolesOf({ access_roles: ['teacher'] })).toEqual(['teacher'])
    expect(accessRolesOf({ role: 'instructor', roles: ['instructor', 'course', 'student'] })).toEqual(['teacher', 'student'])
    expect(canReviewRoleRequests({ role: 'admin' })).toBe(true)
    expect(canReviewRoleRequests({ role: 'course', can_review_role_requests: true })).toBe(true)
    expect(canReviewRoleRequests({ role: 'student' })).toBe(false)
  })
})

describe('WorkspaceSwitcher — no free role switching', () => {
  it('a student without teacher access requests approval instead of switching', async () => {
    api.post.mockResolvedValue({
      success: true,
      pending_approval: true,
      code: 'ROLE_APPROVAL_PENDING',
      message: 'Müəllim icazəsi sorğunuz göndərildi.',
      user: { ...student, teacher_request: { status: 'pending' } },
    })
    render(withRouter(<WorkspaceSwitcher />))
    await userEvent.click(screen.getByRole('button', { name: /Profil\/Kabineti dəyiş/ }))
    expect(screen.getByText('Müəllim icazəsi istə (admin təsdiqi)')).toBeTruthy()
    await userEvent.click(screen.getByText('Müəllim kabineti'))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/switch-workspace', { target: 'teacher' }))
    expect(toast).toHaveBeenCalledWith('Müəllim icazəsi sorğunuz göndərildi.', 'success')
    const state = useAuthStore.getState()
    expect(state.user.role).toBe('student')
    expect(state.user.teacher_request.status).toBe('pending')
    expect(state.token).toBe('t')
  })

  it('pending request: teacher option is disabled; student option hidden when not held', async () => {
    useAuthStore.setState({
      user: { ...student, role: 'parent', access_roles: ['parent'], teacher_request: { status: 'pending' } },
    })
    render(withRouter(<WorkspaceSwitcher />))
    await userEvent.click(screen.getByRole('button', { name: /Profil\/Kabineti dəyiş/ }))
    expect(screen.getByText('İcazə sorğusu təsdiq gözləyir')).toBeTruthy()
    expect(screen.getByText('Müəllim kabineti').closest('button').disabled).toBe(true)
    expect(screen.queryByText('İştirakçı kabineti', { selector: 'span' })).toBeNull()
  })
})

describe('RoleRequestsReview', () => {
  it('lists pending requests and approves one', async () => {
    api.get.mockResolvedValue({
      requests: [
        { id: 'r1', status: 'pending', source: 'workspace_switch', created_at: '2026-10-16T10:00:00Z', note: 'Riyaziyyat', user: { full_name: 'Namizəd', email: 'n@x.az' } },
      ],
    })
    api.post.mockResolvedValue({ success: true })
    render(<RoleRequestsReview />)
    const row = await screen.findByTestId('role-request-row')
    expect(within(row).getByText('Namizəd')).toBeTruthy()
    expect(within(row).getByText('«Riyaziyyat»')).toBeTruthy()
    await userEvent.click(within(row).getByRole('button', { name: 'Təsdiqlə' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/role-requests/r1/approve', {}))
    expect(api.get).toHaveBeenCalledWith('/role-requests?status=pending')
  })
})

describe('GroupInvitesModal', () => {
  const group = { id: 'g1', name: 'Riyaziyyat A' }

  it('Baku wall clock → ISO instant', () => {
    expect(bakuLocalToIso('2026-11-01T12:00')).toBe('2026-11-01T08:00:00.000Z')
    expect(bakuLocalToIso('')).toBeNull()
  })

  it('creates a 24h / 30-use link and shows status, usage and the join log', async () => {
    api.get.mockImplementation(async (url) => {
      if (url.startsWith('/instructor/invites?')) {
        return {
          invites: [
            { id: 'i1', token: 'INV-AAAABBBBCCCC', status: 'active', used_count: 2, max_uses: 30, expires_at: '2026-10-18T10:00:00Z', link: 'https://x/join/INV-AAAABBBBCCCC' },
            { id: 'i2', token: 'INV-DDDDEEEEFFFF', status: 'exhausted', used_count: 5, max_uses: 5, expires_at: '2026-10-20T10:00:00Z', link: 'https://x/join/INV-DDDDEEEEFFFF' },
          ],
        }
      }
      if (url === '/instructor/invites/i1/redemptions') {
        return { redemptions: [{ id: 'x', full_name: 'Tələbə 1', email: 't1@x.az', redeemed_at: '2026-10-17T09:00:00Z' }] }
      }
      return {}
    })
    api.post.mockResolvedValue({ invite: { link: 'https://x/join/INV-NEW' } })
    render(<GroupInvitesModal open onClose={() => {}} group={group} />)
    const rows = await screen.findAllByTestId('invite-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Aktiv')).toBeTruthy()
    expect(within(rows[0]).getByText(/2 \/ 30 istifadə/)).toBeTruthy()
    expect(within(rows[1]).getByText('Limit dolub')).toBeTruthy()
    expect(within(rows[1]).queryByRole('button', { name: 'Linki kopyala' })).toBeNull()

    await userEvent.selectOptions(screen.getByLabelText('Müddət'), '24h')
    await userEvent.click(screen.getByRole('button', { name: 'Link yarat' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/instructor/groups/g1/invites', { duration: '24h', max_uses: 30, label: undefined }),
    )

    const fresh = await screen.findAllByTestId('invite-row')
    await userEvent.click(within(fresh[0]).getByRole('button', { name: 'Kim qoşulub (2)' }))
    const log = await screen.findByTestId('invite-log')
    expect(within(log).getByText(/Tələbə 1/)).toBeTruthy()
  })

  it('custom date is sent as an ISO instant', async () => {
    api.get.mockResolvedValue({ invites: [] })
    api.post.mockResolvedValue({ invite: {} })
    render(<GroupInvitesModal open onClose={() => {}} group={group} />)
    await screen.findByText('Bu qrup üçün hələ müddətli link yoxdur.')
    await userEvent.selectOptions(screen.getByLabelText('Müddət'), 'custom')
    const input = screen.getByLabelText('Bitmə tarixi')
    await userEvent.type(input, '2026-12-01T18:30')
    const limit = screen.getByLabelText('İstifadə limiti')
    await userEvent.clear(limit)
    await userEvent.type(limit, '12')
    await userEvent.click(screen.getByRole('button', { name: 'Link yarat' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/instructor/groups/g1/invites', {
        duration: 'custom',
        expires_at: '2026-12-01T14:30:00.000Z',
        max_uses: 12,
        label: undefined,
      }),
    )
  })
})

describe('LessonFollowups', () => {
  const lesson = { id: 'l1', state: 'ended', is_owner: true, followups: [] }

  it('teacher attaches an exam and assigns it to the lesson students', async () => {
    api.get.mockImplementation(async (url) => (url === '/exams' ? { exams: [{ id: 'e1', title: 'Mini test' }] } : { materials: [] }))
    api.post.mockResolvedValue({ added: true, assigned: 2, followups: [{ id: 'f1', kind: 'exam', ref_id: 'e1', title: 'Mini test' }] })
    render(withRouter(<LessonFollowups lesson={lesson} />))
    await userEvent.selectOptions(screen.getByLabelText('Növ'), 'exam')
    await screen.findByRole('option', { name: 'Mini test' })
    await userEvent.selectOptions(screen.getByLabelText('Element'), 'e1')
    await userEvent.click(screen.getByRole('button', { name: 'Əlavə et' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/live-lessons/l1/followups', { kind: 'exam', ref_id: 'e1', assign: true }))
    expect(await screen.findByText('Mini test', { selector: 'a, a *' })).toBeTruthy()
    expect(toast).toHaveBeenCalledWith('Əlavə olundu və 2 tələbəyə təyin edildi', 'success')
  })

  it('students only see the list (no form); nothing renders when empty', () => {
    const { container, rerender } = render(withRouter(<LessonFollowups lesson={{ ...lesson, is_owner: false, followups: [] }} />))
    expect(container.textContent).toBe('')
    rerender(
      withRouter(
        <LessonFollowups lesson={{ ...lesson, is_owner: false, followups: [{ id: 'f', kind: 'material', title: 'Konspekt' }] }} />,
      ),
    )
    expect(screen.getByText('Konspekt', { exact: false })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Əlavə et' })).toBeNull()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/student/materials')
  })
})

describe('ParentResults', () => {
  it('shows released scores and hides unreleased ones', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/parent/children') return { children: [{ id: 'c1', full_name: 'Uşaq' }] }
      return {
        exams: [
          { exam_id: 'a', title: 'Açıq', score: 87, released: true, submitted_at: '2026-10-10T10:00:00Z' },
          { exam_id: 'b', title: 'Gecikmiş', score: null, released: false, release_at: '2026-10-20T10:00:00Z', submitted_at: '2026-10-10T10:00:00Z' },
        ],
        assignments: [],
      }
    })
    render(<ParentResults />)
    expect(await screen.findByText('87')).toBeTruthy()
    expect(screen.getByText(/Açılacaq:/)).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/parent/children/c1/results')
  })
})
