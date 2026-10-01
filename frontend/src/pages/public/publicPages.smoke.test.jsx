import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../../i18n'
import useUiStore from '../../hooks/useUi'
import Landing from '../auth/Landing'
import PublicSeoLanding from './PublicSeoLanding'

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/public/feature-flags') return Promise.resolve({ flags: {} })
      if (url === '/public/certified-exams/categories') return Promise.resolve({ categories: [] })
      if (url === '/public/certified-exams/stats') return Promise.resolve({ stats: {} })
      return Promise.resolve({})
    }),
    post: vi.fn(() => Promise.resolve({})),
  },
}))

vi.mock('../../lib/analytics', () => ({
  trackEvent: vi.fn(),
  trackRegisterClick: vi.fn(),
  trackPricingView: vi.fn(),
}))

vi.mock('../../hooks/useSubscriptionPlans', () => ({
  useSubscriptionPlans: () => ({ data: [], isLoading: false }),
}))

const FABRICATED = [/Rəna Məmmədova/, /Kamran Əliyev/, /100%/, /Qeydiyyatsız/i, /rəsmi sertifikat/i, /\bSMS\b/]

function renderAt(path, element) {
  return render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>)
}

let consoleError

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })
  }
})

beforeEach(async () => {
  await i18n.changeLanguage('az')
  useUiStore.setState({ theme: 'light' })
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled()
  consoleError.mockRestore()
})

async function settle() {
  await waitFor(() => expect(document.title).not.toBe(''))
}

describe('Home page (/)', () => {
  it('renders one H1, landmarks, primary nav links and the dominant CTA', async () => {
    renderAt('/', <Landing />)
    await settle()

    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent('Dəqiqələr içində ağıllı testlər yaradın')

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()

    const nav = screen.getAllByRole('navigation', { name: 'Əsas naviqasiya' })[0]
    for (const name of ['Necə işləyir', 'Müəllimlər üçün', 'İmtahanlar', 'Qiymətlər']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Qiymətlər' })).toHaveAttribute('href', '/qiymetler')

    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Pulsuz başla' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pulsuz test yarat/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Əsas məzmuna keç' })).toHaveAttribute('href', '#main')
  })

  it('contains the how-it-works, features and FAQ sections without fabricated claims', async () => {
    renderAt('/', <Landing />)
    await settle()

    expect(document.getElementById('mx-steps')).toBeInTheDocument()
    expect(document.getElementById('mx-features')).toBeInTheDocument()
    expect(document.getElementById('mx-faq')).toBeInTheDocument()
    expect(screen.getAllByText('Nümunə interfeys · illüstrativ məlumat').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('trust-placeholders')).not.toBeInTheDocument()

    const text = document.body.textContent
    for (const pattern of FABRICATED) expect(text).not.toMatch(pattern)
  })

  it('keeps heading levels sequential', async () => {
    renderAt('/', <Landing />)
    await settle()
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  it('renders in English and in dark mode', async () => {
    await i18n.changeLanguage('en')
    useUiStore.setState({ theme: 'dark' })
    const { container } = renderAt('/', <Landing />)
    await settle()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create smart tests in minutes')
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Start free' })).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('theme-dark')
  })
})

describe('Public SEO landings', () => {
  it.each(['/muellimler-ucun', '/imtahanlar', '/qiymetler'])('%s renders one H1, nav, CTA and footer', async (path) => {
    renderAt(path, <PublicSeoLanding />)
    await settle()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Əsas naviqasiya' }).length).toBeGreaterThan(0)
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Pulsuz başla' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
