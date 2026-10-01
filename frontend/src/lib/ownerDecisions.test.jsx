import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '../i18n'
import az from '../locales/az/translation.json'
import en from '../locales/en/translation.json'
import ru from '../locales/ru/translation.json'
import OptionalBetaBadge from '../components/live/OptionalBetaBadge'
import CertificateVerify from '../pages/public/CertificateVerify'
import connectedAccountsSrc from '../components/live/ConnectedMeetingAccounts.jsx?raw'
import settingsSrc from '../pages/instructor/Settings.jsx?raw'

vi.mock('./api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

const LOCALES = { az, en, ru }

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
const params = (s) => [...String(s).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()

/** UI keys added for the owner decisions (legacy plan move, SMS credit, recordings, parent email, revoke, beta). */
const DECISION_KEYS = [
  'settings.legacyMigration.noteScheduled',
  'settings.legacyMigration.noteExtraRenewal',
  'settings.legacyMigration.noteBlocked',
  'settings.legacyMigration.renewBlocked',
  'settings.legacyMigration.monthlyOnly',
  'settings.credit.balance',
  'settings.credit.paidWithCredit',
  'settings.billingStatus.refunded',
  'settings.billingStatus.credited',
  'liveLessons.legacy.deleteAfter',
  'students.form.parentEmail',
  'students.form.parentEmailPh',
  'students.form.parentEmailHint',
  'students.toasts.invalidParentEmail',
  'certificates.verify.revoked',
  'certificates.verify.revokedOn',
  'certificates.verify.revokedNote',
  'live.optionalBeta',
  'live.optionalBetaHint',
]

function stringLeaves(obj, path = '', out = []) {
  if (typeof obj === 'string') out.push([path, obj])
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) stringLeaves(v, path ? `${path}.${k}` : k, out)
  }
  return out
}

describe('owner decisions: translations', () => {
  it('every new key exists in az/en/ru with the same {{params}}', () => {
    const missing = []
    for (const key of DECISION_KEYS) {
      const azVal = get(az, key)
      for (const [lang, dict] of Object.entries(LOCALES)) {
        const v = get(dict, key)
        if (typeof v !== 'string' || !v.trim()) missing.push(`${lang}:${key}`)
        else if (params(v).join() !== params(azVal).join()) missing.push(`${lang}:${key} params`)
      }
    }
    expect(missing).toEqual([])
  })

  it('no copy claims a Google Meet / Zoom integration (account connection is optional beta, links are pasted)', () => {
    const re =
      /(google meet|zoom|meet)[^.]{0,40}(integration|inteqrasiya|интеграц)|(integration|inteqrasiya|интеграц)[^.]{0,40}(google meet|zoom|meet)/i
    const hits = []
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const [p, v] of stringLeaves(dict)) if (re.test(v)) hits.push(`${lang}:${p}`)
    }
    expect(hits).toEqual([])
  })
})

describe('owner decision 7: Google / Zoom connection is labeled optional beta', () => {
  it('badge renders the honest label', async () => {
    await i18n.changeLanguage('en')
    render(<OptionalBetaBadge />)
    expect(screen.getByTestId('optional-beta-badge').textContent).toBe('Optional · beta')
    await i18n.changeLanguage('az')
  })

  it('both connection surfaces show the badge', () => {
    expect(connectedAccountsSrc).toMatch(/<OptionalBetaBadge \/>/)
    expect(settingsSrc.match(/<OptionalBetaBadge \/>/g)?.length).toBe(2)
    expect(settingsSrc).toMatch(/t\('live\.optionalBetaHint'\)/)
  })
})

describe('owner decision 6: public verify page shows revoked + date, not the reason', () => {
  it('renders the revoked badge and date', async () => {
    const api = (await import('./api')).default
    api.get.mockResolvedValueOnce({
      certificate: {
        valid: false,
        status: 'revoked',
        revoked: true,
        revoked_at: '2026-10-01T08:00:00.000Z',
        certificate_no: 'MX-2026-000001',
        student_name: 'Aysel',
        course_title: 'Riyaziyyat',
        instructor_name: 'Müəllim',
        score_pct: 91,
        issued_at: '2026-09-01T08:00:00.000Z',
        assessed_modules: [],
      },
    })
    await i18n.changeLanguage('en')
    render(
      <MemoryRouter initialEntries={['/verify/tok']}>
        <Routes>
          <Route path="/verify/:token" element={<CertificateVerify />} />
        </Routes>
      </MemoryRouter>,
    )
    const note = await waitFor(() => screen.getByTestId('certificate-revoked-note'))
    expect(note.textContent).toMatch(/revoked on/i)
    expect(note.textContent).toMatch(/2026/)
    expect(screen.getByText('Revoked')).toBeTruthy()
    await i18n.changeLanguage('az')
  })
})
