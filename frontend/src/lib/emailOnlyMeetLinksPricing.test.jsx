import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../i18n'
import az from '../locales/az/translation.json'
import en from '../locales/en/translation.json'
import ru from '../locales/ru/translation.json'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../constants/subscriptionPlans'
import { MENTORIX_PRICING_PLANS } from './mentorixPublicMarketing'
import { detectPlatform, safeExternalHref, validateMeetingUrl, validateResourceLink } from './meetingUrl'
import { ToastProvider } from '../components/common/Toast'
import LiveLessonCard from '../components/live/LiveLessonCard'
import PublicPricingCompare from '../components/public/PublicPricingCompare'
import PricingFaq from '../components/public/PricingFaq'

const LOCALES = { az, en, ru }
const SMS_RE = /\bSMS\b|СМС/i
/** Sources keep lowercase identifiers (product_type 'sms', locale key names, chatbot search keywords); visible copy is upper-case. */
const SMS_SOURCE_RE = /\bSMS\b|СМС/
const FAKE_VIDEO_CLAIMS = [
  /limitsiz iştirakçı/i,
  /unlimited participants/i,
  /livekit/i,
  /video hosting/i,
  /zoom integration/i,
  /google meet integration/i,
  /meet inteqrasiyası/i,
  /zoom inteqrasiyası/i,
]

function stringLeaves(obj, path = '', out = []) {
  if (typeof obj === 'string') out.push([path, obj])
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) stringLeaves(v, path ? `${path}.${k}` : k, out)
  }
  return out
}

const PUBLIC_SOURCES = {
  ...import.meta.glob(['../components/public/*.jsx', '../pages/public/*.jsx', '../components/live/*.jsx', '../pages/live/*.jsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob(
    [
      './mentorixPublicMarketing.js',
      './publicSeoLandings.js',
      './landingCopy.js',
      './meetingUrl.js',
      './liveLessons.js',
      '../locales/publicLandings.js',
      '../constants/subscriptionPlans.js',
      '../constants/defaultLoginMarketing.js',
      '../mentor/*.js',
      '../pages/auth/Landing.jsx',
      '../pages/instructor/Settings.jsx',
      '../pages/instructor/Dashboard.jsx',
      '../pages/student/Exams.jsx',
      '../components/instructor/ExamForm.jsx',
      '../components/instructor/BillingLimitTopUpModal.jsx',
      '../layouts/InstructorLayout.jsx',
      '../layouts/StudentLayout.jsx',
    ],
    { query: '?raw', import: 'default', eager: true },
  ),
}

describe('no SMS anywhere user-facing', () => {
  for (const [lang, dict] of Object.entries(LOCALES)) {
    it(`${lang} translations never mention SMS`, () => {
      const hits = stringLeaves(dict).filter(([, v]) => SMS_RE.test(v)).map(([p]) => p)
      expect(hits).toEqual([])
    })
  }

  it('public, pricing, live-lesson and teacher sources never mention SMS', () => {
    const files = Object.keys(PUBLIC_SOURCES)
    expect(files.length).toBeGreaterThan(20)
    const hits = files.filter((f) => SMS_SOURCE_RE.test(PUBLIC_SOURCES[f]))
    expect(hits).toEqual([])
  })

  it('pricing plan data never mentions SMS', () => {
    expect(SMS_RE.test(JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS))).toBe(false)
    expect(SMS_RE.test(JSON.stringify(MENTORIX_PRICING_PLANS))).toBe(false)
  })
})

describe('no internal-video or fake integration claims', () => {
  it('translations and public sources avoid fake video claims', () => {
    const corpus = [
      ...Object.values(LOCALES).flatMap((d) => stringLeaves(d).map(([p, v]) => [`locale:${p}`, v])),
      ...Object.entries(PUBLIC_SOURCES),
      ['plans', JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS)],
      ['marketing', JSON.stringify(MENTORIX_PRICING_PLANS)],
    ]
    const hits = []
    for (const [where, text] of corpus) for (const re of FAKE_VIDEO_CLAIMS) if (re.test(text)) hits.push(`${where} ~ ${re}`)
    expect(hits).toEqual([])
  })
})

describe('public pricing: exactly three spec plans', () => {
  it('offline plans match the spec numbers', () => {
    const byId = Object.fromEntries(DEFAULT_SUBSCRIPTION_PLANS.map((p) => [p.id, p]))
    expect(DEFAULT_SUBSCRIPTION_PLANS.map((p) => p.id)).toEqual(['basic', 'growth', 'premium'])
    expect(DEFAULT_SUBSCRIPTION_PLANS.map((p) => p.price_azn)).toEqual([0, 10, 19])
    const GB = 1024 ** 3
    expect(byId.basic.limits).toMatchObject({ students: 5, storage_limit_bytes: GB, exams_monthly: 3, homeworks_monthly: 5 })
    expect(byId.growth.limits).toMatchObject({ students: 50, storage_limit_bytes: 20 * GB, exams_monthly: 50, homeworks_monthly: 120 })
    expect(byId.premium.limits).toMatchObject({ students: null, storage_limit_bytes: 50 * GB, exams_monthly: null, homeworks_monthly: null })
    expect(byId.basic.plan_cta).toBe('Pulsuz başla')
    expect(byId.growth.highlight).toBe(true)
  })

  it('marketing plans list three tiers with the trial label', () => {
    expect(MENTORIX_PRICING_PLANS).toHaveLength(3)
    expect(JSON.stringify(MENTORIX_PRICING_PLANS)).toContain('21 günlük pulsuz sınaq')
  })

  it('live lessons are described as link support, never as an integration', () => {
    for (const dict of Object.values(LOCALES)) {
      expect(dict.planCopy.limits.liveLessonLinks).toMatch(/Google Meet/)
      expect(dict.planCopy.limits.liveLessonLinks).toMatch(/Zoom/)
    }
  })

  it('every locale has 8 FAQ entries with question and answer', () => {
    for (const dict of Object.values(LOCALES)) {
      const faq = dict.landing.pricingPage.faq
      expect(Array.isArray(faq)).toBe(true)
      expect(faq).toHaveLength(8)
      for (const item of faq) {
        expect(item.q?.trim()).toBeTruthy()
        expect(item.a?.trim()).toBeTruthy()
      }
    }
  })
})

describe('pricing components render', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('az')
  })

  it('compare table shows three plan columns and no SMS row', () => {
    const { container } = render(
      <MemoryRouter>
        <PublicPricingCompare plans={DEFAULT_SUBSCRIPTION_PLANS} onCta={() => {}} tableOnly />
      </MemoryRouter>,
    )
    expect(container.textContent).not.toMatch(SMS_RE)
    expect(container.textContent).toContain(az.landing.plans.basic.title)
    expect(container.textContent).toContain(az.landing.plans.growth.title)
    expect(container.textContent).toContain(az.landing.plans.premium.title)
  })

  it('FAQ renders all questions', () => {
    render(<PricingFaq />)
    for (const item of az.landing.pricingPage.faq) expect(screen.getByText(item.q)).toBeTruthy()
  })
})

describe('meeting link validation (client mirror)', () => {
  it('accepts canonical Meet / Zoom / other https links', () => {
    expect(validateMeetingUrl('https://meet.google.com/abc-defg-hij', 'google_meet')).toMatchObject({ ok: true, url: 'https://meet.google.com/abc-defg-hij' })
    expect(validateMeetingUrl('https://us02web.zoom.us/j/1234567890?pwd=abc', 'zoom')).toMatchObject({ ok: true })
    expect(validateMeetingUrl('https://teams.microsoft.com/l/meetup-join/xyz', 'other')).toMatchObject({ ok: true })
  })

  it('rejects unsafe or malformed links', () => {
    const bad = [
      ['javascript:alert(1)', 'other'],
      ['http://meet.google.com/abc-defg-hij', 'google_meet'],
      ['https://evil.com/abc-defg-hij', 'google_meet'],
      ['https://meet.google.com.evil.com/abc-defg-hij', 'google_meet'],
      ['https://zoom.us.evil.com/j/1234567890', 'zoom'],
      ['https://user:pass@example.com/room', 'other'],
      ['https://127.0.0.1/room', 'other'],
      ['https://localhost/room', 'other'],
      ['https://example.com/go?url=https://evil.com', 'other'],
      ['https://example.com/<script>', 'other'],
      ['', 'other'],
      ['https://meet.google.com/abc-defg-hij', 'zoom'],
      ['https://example.com/room', 'webex'],
    ]
    for (const [url, platform] of bad) expect(validateMeetingUrl(url, platform).ok, `${url} (${platform})`).toBe(false)
  })

  it('resource links must be safe https', () => {
    expect(validateResourceLink('https://docs.google.com/document/d/1').ok).toBe(true)
    expect(validateResourceLink('data:text/html,hi').ok).toBe(false)
  })

  it('detects platforms and only renders https hrefs', () => {
    expect(detectPlatform('https://meet.google.com/abc-defg-hij')).toBe('google_meet')
    expect(detectPlatform('https://acme.zoom.us/j/12345678901')).toBe('zoom')
    expect(detectPlatform('https://teams.microsoft.com/x')).toBe('other')
    expect(safeExternalHref('javascript:alert(1)')).toBeNull()
    expect(safeExternalHref('http://zoom.us/j/1')).toBeNull()
    expect(safeExternalHref('https://zoom.us/j/1234567890')).toBe('https://zoom.us/j/1234567890')
  })
})

describe('LiveLessonCard join link', () => {
  const base = {
    id: 'l1',
    title: 'Riyaziyyat',
    state: 'upcoming',
    platform: 'google_meet',
    platform_name: 'Google Meet',
    starts_at: '2030-01-01T10:00:00Z',
    ends_at: '2030-01-01T11:00:00Z',
    group_name: '9A',
    is_owner: false,
    materials: [],
  }
  const renderCard = (lesson) =>
    render(
      <ToastProvider>
        <LiveLessonCard lesson={lesson} />
      </ToastProvider>,
    )

  beforeEach(async () => {
    await i18n.changeLanguage('az')
  })

  it('opens the external link in a new tab with noopener', () => {
    renderCard({ ...base, can_join: true, join_url: 'https://meet.google.com/abc-defg-hij' })
    const link = screen.getByRole('link', { name: new RegExp(az.liveLessons.join) })
    expect(link.getAttribute('href')).toBe('https://meet.google.com/abc-defg-hij')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('hides the link when the server says the viewer cannot join', () => {
    const { container } = renderCard({ ...base, can_join: false, join_url: null })
    expect(within(container).queryByRole('link')).toBeNull()
  })

  it('never renders non-https join links', () => {
    const { container } = renderCard({ ...base, can_join: true, join_url: 'javascript:alert(1)' })
    expect(within(container).queryByRole('link')).toBeNull()
  })
})
