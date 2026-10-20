import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const toast = vi.fn()
vi.mock('../../components/common/Toast', () => ({ useToast: () => toast }))
vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('qrcode.react', () => ({ QRCodeCanvas: ({ value }) => <canvas data-testid="qr" data-value={value} /> }))

import api from '../../lib/api'
import InstructorTeachingGroups, { filterSubjects } from './TeachingGroups'
import TeachingGroupDetail from './TeachingGroupDetail'

const LONG = 'Çox uzun sahə adı — Riyaziyyat və məntiq üzrə buraxılış imtahanına hazırlıq kursu'
const subjectsFixture = () => [
  {
    id: 's1',
    name: 'Info',
    student_count: 10,
    income_this_month: 0,
    groups: [
      { id: 'g1', name: 'info(2,5)', student_count: 5, invite_ready: true, default_billing_type: '8_lessons', default_package_fee: 100, join_code: 'MX-85961', invitation_link: 'https://mentorix.io/join/MX-85961' },
      { id: 'g2', name: 'info(1,4)', student_count: 0, invite_ready: false, join_code: 'MX-29634' },
    ],
  },
  { id: 's2', name: 'Data Analitika', student_count: 0, income_this_month: 0, groups: [{ id: 'g3', name: 'Python axşam', student_count: 0, invite_ready: true, default_billing_type: '12_lessons', default_package_fee: 150, join_code: 'MX-11111' }] },
  { id: 's3', name: LONG, student_count: 0, income_this_month: 0, groups: [] },
]

let subjects
let liveLessons
function mockApi() {
  api.get.mockImplementation(async (url) => {
    if (url === '/instructor/teaching') return { subjects }
    if (url.startsWith('/live-lessons')) return { lessons: liveLessons }
    if (url.startsWith('/instructor/invites')) return { invites: [] }
    if (url === '/students')
      return {
        students: [
          { enrollment_id: 'e1', full_name: 'Aysel', group_id: 'g1', enrollment_status: 'active' },
          { enrollment_id: 'e2', full_name: 'Tural', group_id: 'g3', enrollment_status: 'active' },
          { enrollment_id: 'e3', full_name: 'Köhnə', group_id: 'g1', enrollment_status: 'left' },
        ],
      }
    if (url === '/billing/status') return { should_block: false }
    return {}
  })
}

function renderAt(path = '/instructor/teaching-groups') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/instructor/teaching-groups" element={<InstructorTeachingGroups />} />
          <Route path="/instructor/teaching-groups/:groupId" element={<TeachingGroupDetail />} />
          <Route path="*" element={<p data-testid="elsewhere">elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const sections = () => screen.getAllByTestId('subject-section')
const toggleOf = (sec) => within(sec).getAllByRole('button')[0]

beforeEach(() => {
  vi.clearAllMocks()
  subjects = subjectsFixture()
  liveLessons = []
  mockApi()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue() }, configurable: true })
})

describe('Sahələr və qruplar', () => {
  it('compact list: first subject open, others closed; package summary; no delete buttons in the list', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Sahələr və qruplar' })).toBeTruthy()
    await screen.findAllByTestId('subject-section')
    const [info, data, long] = sections()
    expect(toggleOf(info).getAttribute('aria-expanded')).toBe('true')
    expect(toggleOf(data).getAttribute('aria-expanded')).toBe('false')
    expect(within(long).getByText(LONG)).toBeTruthy()
    const rows = within(info).getAllByTestId('group-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getAllByText('8 dərs · 100 ₼').length).toBeGreaterThan(0)
    expect(within(rows[1]).getAllByText('Paket təyin edilməyib').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /^Sil$/ })).toBeNull()
    expect(screen.queryByText('MX-85961')).toBeNull()
    expect(screen.queryByPlaceholderText('Məs: Python')).toBeNull()
    // No live lesson → plain «Canlı dərs», no live indicator.
    expect(within(rows[0]).getByRole('button', { name: 'info(2,5): canlı dərs planla' }).textContent).toBe('Canlı dərs')
  })

  it('opened sections stay open across reloads; «+ Qrup» and ⋯ do not toggle the section', async () => {
    renderAt()
    await screen.findAllByTestId('subject-section')
    await userEvent.click(toggleOf(sections()[1]))
    expect(toggleOf(sections()[1]).getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(within(sections()[1]).getByRole('button', { name: 'Data Analitika — sahə əməliyyatları' }))
    expect(toggleOf(sections()[1]).getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(sections()[0]).getByRole('button', { name: 'Info sahəsinə qrup əlavə et' }))
    expect(await screen.findByRole('dialog', { name: 'Yeni qrup' })).toBeTruthy()
    expect(toggleOf(sections()[0]).getAttribute('aria-expanded')).toBe('true')
  })

  it('search opens the matching subject, shows «Uyğun nəticə tapılmadı», and restores the previous state', async () => {
    renderAt()
    await screen.findAllByTestId('subject-section')
    const box = screen.getByRole('searchbox')
    await userEvent.type(box, 'python')
    expect(sections()).toHaveLength(1)
    expect(toggleOf(sections()[0]).getAttribute('aria-expanded')).toBe('true')
    expect(within(sections()[0]).getByText('Python axşam')).toBeTruthy()
    await userEvent.clear(box)
    await userEvent.type(box, 'yoxdur-belə')
    expect(screen.getByText('Uyğun nəticə tapılmadı')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Axtarışı təmizlə' }))
    expect(sections()).toHaveLength(3)
    expect(toggleOf(sections()[1]).getAttribute('aria-expanded')).toBe('false')
    expect(filterSubjects(subjects, 'info').map((x) => x.groups.length)).toEqual([2])
  })

  it('«Dəvət et» panel is bound to the clicked group: link, copy feedback, QR from the same link, timed links', async () => {
    renderAt()
    await screen.findAllByTestId('subject-section')
    const rows = within(sections()[0]).getAllByTestId('group-row')
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Info / info(2,5): dəvət et' }))
    const drawer = await screen.findByRole('dialog', { name: 'Dəvət et — info(2,5)' })
    expect(within(drawer).getByText('Info')).toBeTruthy()
    expect(within(drawer).getByTestId('invite-link').textContent).toBe('https://mentorix.io/join/MX-85961')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Linki kopyala' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://mentorix.io/join/MX-85961')
    expect(await within(drawer).findByRole('button', { name: '✓ Kopyalandı' })).toBeTruthy()
    await userEvent.click(within(drawer).getByRole('button', { name: 'QR göstər' }))
    expect(within(drawer).getByTestId('qr').getAttribute('data-value')).toBe('https://mentorix.io/join/MX-85961')
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/instructor/invites?group_id=g1'))

    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Kopyala' }))
    expect(await within(drawer).findByText(/Kopyalamaq alınmadı/)).toBeTruthy()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByTestId('invite-drawer')).toBeNull())
  })

  it('subject with students is blocked; empty subject delete names its groups; cancel and failure keep data', async () => {
    renderAt()
    await screen.findAllByTestId('subject-section')
    await userEvent.click(within(sections()[0]).getByRole('button', { name: 'Info — sahə əməliyyatları' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sahəni sil' }))
    const blocked = await screen.findByRole('dialog', { name: 'Sahəni silmək olmur' })
    expect(within(blocked).getByText(/10 tələbə/)).toBeTruthy()
    expect(within(blocked).queryByRole('button', { name: 'Sahəni sil' })).toBeNull()
    await userEvent.click(within(blocked).getByRole('button', { name: 'Anladım' }))

    await userEvent.click(within(sections()[1]).getByRole('button', { name: 'Data Analitika — sahə əməliyyatları' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sahəni sil' }))
    let dlg = await screen.findByRole('dialog', { name: 'Sahəni sil' })
    expect(within(dlg).getByText('Python axşam')).toBeTruthy()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Ləğv et' }))
    expect(api.delete).not.toHaveBeenCalled()

    api.delete.mockRejectedValueOnce({ message: 'Server xətası' })
    await userEvent.click(within(sections()[1]).getByRole('button', { name: 'Data Analitika — sahə əməliyyatları' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sahəni sil' }))
    dlg = await screen.findByRole('dialog', { name: 'Sahəni sil' })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Sahəni sil' }))
    expect(api.delete).toHaveBeenCalledWith('/instructor/teaching/subjects/s2')
    expect(await within(dlg).findByRole('alert')).toHaveTextContent('Server xətası')
    expect(screen.getAllByTestId('subject-section')).toHaveLength(3)
  })

  it('group with students cannot be deleted; empty group asks with its exact name', async () => {
    renderAt()
    await screen.findAllByTestId('subject-section')
    const rows = within(sections()[0]).getAllByTestId('group-row')
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'info(2,5) — qrup əməliyyatları' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Qrupu sil' }))
    expect(await screen.findByRole('dialog', { name: 'Qrupu silmək olmur' })).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'info(1,4) — qrup əməliyyatları' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Qrupu sil' }))
    const dlg = await screen.findByRole('dialog', { name: 'Qrupu sil' })
    expect(within(dlg).getByText('«info(1,4)»')).toBeTruthy()
    api.delete.mockResolvedValueOnce({ success: true })
    await userEvent.click(within(dlg).getByRole('button', { name: 'Qrupu sil' }))
    expect(api.delete).toHaveBeenCalledWith('/instructor/teaching/groups/g2')
  })

  it('«+ Qrup»: subject preset, validation keeps the typed name, nothing is sent', async () => {
    renderAt()
    await screen.findAllByTestId('subject-section')
    await userEvent.click(within(sections()[1]).getByRole('button', { name: 'Data Analitika sahəsinə qrup əlavə et' }))
    const dlg = await screen.findByRole('dialog', { name: 'Yeni qrup' })
    expect(within(dlg).getByText('Data Analitika')).toBeTruthy()
    await userEvent.type(within(dlg).getByLabelText('Qrup adı'), 'SQL səhər')
    await userEvent.click(within(dlg).getByRole('button', { name: /Qrupu yarat/ }))
    expect(within(dlg).getByRole('alert')).toBeTruthy()
    expect(within(dlg).getByLabelText('Qrup adı').value).toBe('SQL səhər')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('a live lesson turns the button into «Dərsə qoşul» with the real link', async () => {
    liveLessons = [{ id: 'l1', group_id: 'g1', state: 'live', start_url: 'https://meet.example/abc' }]
    renderAt()
    await screen.findAllByTestId('subject-section')
    const rows = within(sections()[0]).getAllByTestId('group-row')
    const join = await within(rows[0]).findByRole('link', { name: /dərsə qoşul/ })
    expect(join.getAttribute('href')).toBe('https://meet.example/abc')
    expect(within(rows[1]).getByRole('button', { name: 'info(1,4): canlı dərs planla' })).toBeTruthy()
  })

  it('empty, error and detail views', async () => {
    subjects = []
    const { unmount } = renderAt()
    expect(await screen.findByText('Hələ sahə yoxdur')).toBeTruthy()
    unmount()

    api.get.mockImplementation(async (url) => {
      if (url === '/instructor/teaching') throw { message: 'Şəbəkə xətası' }
      return {}
    })
    const second = renderAt()
    expect(await screen.findByText('Şəbəkə xətası')).toBeTruthy()
    second.unmount()

    subjects = subjectsFixture()
    mockApi()
    renderAt('/instructor/teaching-groups/g1')
    const detail = await screen.findByTestId('group-detail')
    expect(within(detail).getByRole('heading', { name: 'info(2,5)' })).toBeTruthy()
    expect(within(detail).getByText('Aysel')).toBeTruthy()
    expect(within(detail).queryByText('Tural')).toBeNull()
    expect(within(detail).queryByText('Köhnə')).toBeNull()
    expect(within(detail).getByRole('navigation', { name: 'Naviqasiya' }).textContent).toMatch(/Sahələr və qruplar\/Info\/info\(2,5\)/)
  })
})

// keep act imported for environments that warn about un-awaited updates
void act
