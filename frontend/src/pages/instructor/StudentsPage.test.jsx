import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../components/common/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import InstructorStudents from './Students'

const student = (i, extra = {}) => ({
  enrollment_id: `e${i}`,
  id: `s${i}`,
  full_name: ['Aysel Babayeva', 'Tural Quliyev'][i],
  phone: `+99450100000${i}`,
  subject: 'Riyaziyyat',
  subject_id: 'sub1',
  group: '11-A',
  group_id: 'g1',
  enrollment_status: 'active',
  configured_at: '2026-09-01',
  billing_type: '8_lessons',
  billing_timing: i ? 'prepaid' : 'postpaid',
  payment_plan: 'full',
  lesson_weekdays: [1, 3],
  lesson_times: { 1: '15:00', 3: '15:00' },
  calendar_used_lessons: 5,
  calendar_total_lessons: 8,
  ...extra,
})

function setup() {
  api.get.mockImplementation(async (url) => {
    if (url === '/students') return { students: [student(0), student(1)] }
    if (url === '/instructor/teaching')
      return {
        subjects: [
          { id: 'sub1', name: 'Riyaziyyat', groups: [{ id: 'g1', name: '11-A' }, { id: 'g9', name: 'Boş qrup', student_count: 0 }] },
        ],
      }
    if (url === '/billing/status') return { status: 'active', plan: { features: {} } }
    return {}
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InstructorStudents />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  useAuthStore.setState({ user: { id: 't1', role: 'instructor', access_roles: ['teacher'] }, token: 't' })
})

describe('Tələbələrim — redesigned list keeps every action', () => {
  it('header shows the count; groups expand with labelled columns, text statuses and the row menu', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Tələbələrim' })).toBeTruthy()
    expect((await screen.findAllByText('2 tələbə')).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Dəvət linki/ })).toBeTruthy()

    const groups = await screen.findAllByTestId('students-group')
    // Non-empty groups first, the empty one at the bottom.
    expect(within(groups[0]).getByText('11-A')).toBeTruthy()
    expect(within(groups[groups.length - 1]).getByText('Boş qrup')).toBeTruthy()

    const toggle = within(groups[0]).getByRole('button', { name: 'Qrupu aç' })
    await userEvent.click(toggle)
    const rows = await within(groups[0]).findAllByTestId('student-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].getAttribute('draggable')).toBe('true')
    expect(within(groups[0]).getByText('Dərslər', { selector: 'span' })).toBeTruthy()
    expect(within(rows[0]).getAllByText('5/8 dərs').length).toBeGreaterThan(0)
    expect(within(rows[0]).getAllByText('Sonradan ödəniş').length).toBeGreaterThan(0)
    expect(within(rows[1]).getAllByText('Öncədən ödəniş').length).toBeGreaterThan(0)
    expect(within(rows[0]).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('63')

    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Aysel Babayeva — əməliyyatlar' }))
    for (const item of ['Redaktə', 'Dərslər', 'Köhnə ödənişlər', 'Sil']) {
      expect(await screen.findByRole('menuitem', { name: item })).toBeTruthy()
    }
    await userEvent.click(within(groups[0]).getByRole('button', { name: 'Qrupu bağla' }))
    await waitFor(() => expect(within(groups[0]).queryAllByTestId('student-row')).toHaveLength(0))
  })

  it('an empty group keeps rename/delete in its menu', async () => {
    setup()
    const groups = await screen.findAllByTestId('students-group')
    const empty = groups[groups.length - 1]
    await userEvent.click(within(empty).getByRole('button', { name: 'Qrup əməliyyatları' }))
    expect(await screen.findByRole('menuitem', { name: 'Qrup adını dəyiş' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Boş qrupu sil' })).toBeTruthy()
  })

  it('search filters students by name', async () => {
    setup()
    const groups = await screen.findAllByTestId('students-group')
    await userEvent.click(within(groups[0]).getByRole('button', { name: 'Qrupu aç' }))
    await userEvent.type(screen.getByRole('searchbox'), 'Tural')
    await waitFor(() => expect(screen.getAllByTestId('student-row')).toHaveLength(1))
    expect(screen.getAllByTestId('students-group')).toHaveLength(1)
  })
  it('calm card: no green frame when open, relative next lesson, chat sits in the actions cell', async () => {
    setup()
    const groups = await screen.findAllByTestId('students-group')
    const card = groups[0]
    expect(card.textContent).toMatch(/Növbəti dərs:?\s*\d+ (dəq|saat|gün) sonra/)
    expect(card.textContent).not.toMatch(/Orta bal/)
    await userEvent.click(within(card).getByRole('button', { name: 'Qrupu aç' }))
    expect(card.className).not.toMatch(/border-primary/)
    expect(card.querySelector('.bg-primary.absolute')).toBeNull()
    expect(within(card).getByText('Əməliyyatlar')).toBeTruthy()
    const row = within(card).getAllByTestId('student-row')[0]
    const menuBtn = within(row).getByRole('button', { name: 'Aysel Babayeva — əməliyyatlar' })
    const actionsCell = menuBtn.parentElement.parentElement
    expect(actionsCell.querySelectorAll('button').length).toBeGreaterThanOrEqual(2)
    expect(row.textContent).not.toMatch(/—/)
  })
})
