import { describe, expect, it } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '../../i18n'
import PublicPricingAudienceGroups from './PublicPricingAudienceGroups'
import Modal from '../common/Modal'
import audienceSrc from './PublicPricingAudienceGroups.jsx?raw'
import compareSrc from './PublicPricingCompare.jsx?raw'
import faqSrc from './PricingFaq.jsx?raw'
import explainerSrc from './PricingAudienceExplainer.jsx?raw'
import featureSrc from '../landing/PricingFeatureListItem.jsx?raw'
import liveCardSrc from '../live/LiveLessonCard.jsx?raw'
import liveIconSrc from '../live/PlatformIcon.jsx?raw'
import liveFormSrc from '../live/LiveLessonFormModal.jsx?raw'
import modalSrc from '../common/Modal.jsx?raw'
import liveLessonsPageSrc from '../../pages/live/LiveLessons.jsx?raw'
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
/** Raw palette utilities the redesign replaced with tokens (bg-surface, text-fg, border-line, ...). */
const RAW_PALETTE_RE = /\b(?:bg|text|border|divide)-(?:white|slate-\d+|gray-\d+|zinc-\d+|emerald-\d+|purple-\d+|sky-\d+|red-\d+|amber-\d+|primary)\b|text-\[#041018\]/

function renderPricing() {
  return render(
    <MemoryRouter>
      <PublicPricingAudienceGroups plans={DEFAULT_SUBSCRIPTION_PLANS} />
    </MemoryRouter>,
  )
}

describe('release/site-pricing: pricing screens', () => {
  it('audience tabs have no emojis and are real tabs', () => {
    renderPricing()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    for (const tab of tabs) expect(tab.textContent).not.toMatch(EMOJI_RE)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(tabs[1])
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'pricing-tab-mentor')
    expect(audienceSrc).not.toMatch(EMOJI_RE)
  })

  it('comparison: stacked cards for phones, focusable labelled scroll region for wider screens', () => {
    renderPricing()
    const mobile = screen.getByTestId('pricing-compare-mobile')
    expect(mobile.className).toMatch(/\bsm:hidden\b/)
    const cards = within(mobile).getAllByRole('region')
    expect(cards).toHaveLength(DEFAULT_SUBSCRIPTION_PLANS.length)
    for (const card of cards) expect(within(card).getAllByRole('term').length).toBeGreaterThanOrEqual(8)

    const tableRegion = screen.getByTestId('pricing-compare-table')
    expect(tableRegion).toHaveAttribute('tabindex', '0')
    expect(tableRegion).toHaveAttribute('role', 'region')
    expect(tableRegion.getAttribute('aria-labelledby')).toBe('mx-pricing-compare')
    expect(tableRegion.className).toMatch(/\bhidden\b.*\bsm:block\b/)
    expect(within(tableRegion).getByRole('table')).toBeTruthy()
  })

  it('pricing and live-lesson components use design tokens, not raw palette classes', () => {
    const files = { audienceSrc, compareSrc, faqSrc, explainerSrc, featureSrc, liveCardSrc, liveIconSrc, liveFormSrc, modalSrc, liveLessonsPageSrc }
    const hits = Object.entries(files)
      .filter(([, src]) => RAW_PALETTE_RE.test(src))
      .map(([name, src]) => `${name}: ${src.match(RAW_PALETTE_RE)[0]}`)
    expect(hits).toEqual([])
  })

  it('modal dialogs are named by their title', () => {
    render(
      <Modal open onClose={() => {}} title="Dərs yarat" closeLabel="Bağla">
        <p>body</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Dərs yarat' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bağla' })).toBeTruthy()
  })
})
