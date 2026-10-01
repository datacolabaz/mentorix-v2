import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'
import DashboardSummary from './DashboardSummary'

vi.mock('../../lib/api', () => ({ default: { get: vi.fn() } }))

const TEACHER = {
  role: 'teacher',
  items: [
    { key: 'unread_submissions', available: true, count: 3, href: '/notifications?unread=1', tone: 'blue' },
    {
      key: 'pending_grading',
      available: true,
      count: 4,
      href: '/instructor/engagement?tab=assignments',
      tone: 'yellow',
      detail: { assignments: 3, exams: 1 },
    },
    { key: 'overdue_assignments', available: true, count: 0, href: '/instructor/engagement?tab=assignments', tone: 'red', detail: { assignments: 0 } },
    { key: 'assessment_expiry', available: false, count: 0, href: '/instructor/engagement?tab=exams', tone: 'yellow' },
    { key: 'unviewed_materials', available: true, count: 5, href: '/instructor/engagement?tab=materials', tone: 'gray', detail: { materials: 2, overdue: 1 } },
    { key: 'join_requests', available: true, count: 1, href: '/instructor/join-requests', tone: 'blue' },
  ],
  recent_activity: {
    window_hours: 24,
    total: 2,
    capped: false,
    counts: { submissions: 2, exams_completed: 0, exams_started: 0, material_views: 0, downloads: 0, expired: 0 },
    latest: [
      { event_type: 'assignment_submitted', entity_type: 'assignment', entity_id: 'a1', entity_title: 'Faiz məsələləri', student_name: 'Aysel Məmmədova', at: new Date().toISOString() },
    ],
  },
}

const STUDENT = {
  role: 'student',
  items: [
    { key: 'new_assessments', available: true, count: 1, href: '/student/exams', tone: 'blue' },
    {
      key: 'upcoming_deadlines',
      available: true,
      count: 2,
      href: '/student/assignments',
      tone: 'yellow',
      detail: { next_at: '2026-09-29T17:34:00Z', assignments: 1, assessments: 1, window_days: 7 },
    },
  ],
  group_join: {
    pending: 1,
    approved_recent: 1,
    rejected_recent: 0,
    requests: [
      { status: 'pending', group_name: '7A riyaziyyat — həftəsonu intensiv hazırlıq qrupu', at: '2026-09-29T17:34:00Z' },
      { status: 'approved', group_name: '8B', at: '2026-09-28T10:00:00Z' },
    ],
    href: '/student/groups',
  },
}

function renderWith(role, fetcher, props = {}) {
  return render(
    <MemoryRouter>
      <DashboardSummary role={role} fetcher={fetcher} {...props} />
    </MemoryRouter>,
  )
}

describe('DashboardSummary', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('az')
  })

  it('teacher: counts, status text and links to the existing pages', async () => {
    renderWith('teacher', vi.fn().mockResolvedValue({ summary: TEACHER }))
    const grading = await screen.findByRole('link', { name: /Qiymətləndirmə gözləyir: 4/ })
    expect(grading).toHaveAttribute('href', '/instructor/engagement?tab=assignments')
    expect(within(grading).getByText('Baxılmalıdır')).toBeInTheDocument()
    expect(within(grading).getByText('Tapşırıq: 3 · İmtahan: 1')).toBeInTheDocument()

    const overdue = screen.getByRole('link', { name: /Vaxtı keçmiş tapşırıqlar: 0/ })
    expect(within(overdue).getByText('Yoxdur')).toBeInTheDocument()

    const expiry = screen.getByRole('link', { name: /Vaxtı bitən imtahanlar: —/ })
    expect(within(expiry).getByText('Məlumat alınmadı')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Qoşulma sorğuları: 1/ })).toHaveAttribute('href', '/instructor/join-requests')
    expect(screen.getByText('Diqqət tələb edir: 4')).toBeInTheDocument()
    expect(screen.getByText('Aysel Məmmədova')).toBeInTheDocument()
    expect(screen.getByText('Təqdim: 2')).toBeInTheDocument()
  })

  it('student: passes the active group to the request and shows join status with dates (az)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ summary: STUDENT })
    renderWith('student', fetcher, { enrollmentId: 'enr-1' })
    await screen.findByText('Qrupa qoşulma sorğuları')
    expect(fetcher).toHaveBeenCalledWith('enr-1')
    const longName = screen.getByText('7A riyaziyyat — həftəsonu intensiv hazırlıq qrupu')
    expect(longName.className).toMatch(/break-words/)
    expect(screen.getByText('Gözləyir')).toBeInTheDocument()
    expect(screen.getByText('Qəbul edildi')).toBeInTheDocument()
    expect(screen.getAllByText('29.09.2026, 21:34').length).toBeGreaterThan(0)
  })

  it('english dates use the en format', async () => {
    await i18n.changeLanguage('en')
    renderWith('student', vi.fn().mockResolvedValue({ summary: STUDENT }))
    await screen.findByText('Group join requests')
    expect(screen.getAllByText('Sep 29, 2026, 21:34').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Upcoming deadlines \(7 days\): 2/ })).toHaveAttribute('href', '/student/assignments')
  })

  it('shows a loading state, then an error with retry that reloads', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ summary: TEACHER })
    renderWith('teacher', fetcher)
    expect(screen.getByRole('status')).toHaveTextContent('Xülasə yüklənir…')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Xülasəni yükləmək alınmadı.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Yenidən cəhd et' }))
    await screen.findByRole('link', { name: /Qiymətləndirmə gözləyir: 4/ })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('admin: all clear state and aggregate-only note', async () => {
    const summary = {
      role: 'admin',
      items: [
        { key: 'security_events', available: true, count: 0, href: '/notifications?category=security', severity: 'ok', detail: { auth_failures_24h: 0 } },
        { key: 'partner_applications', available: true, count: 0, href: '/admin/partners?status=pending', severity: 'ok', detail: {} },
      ],
      omitted: [],
    }
    renderWith('admin', vi.fn().mockResolvedValue({ summary }))
    await screen.findByText('Hər şey qaydasındadır')
    expect(screen.getByText(/yalnız ümumi saylar göstərilir/)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Gözləyən partnyor müraciətləri: 0/ })).toHaveAttribute('href', '/admin/partners?status=pending'),
    )
  })
})
