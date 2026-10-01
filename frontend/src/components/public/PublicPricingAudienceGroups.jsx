import PublicPricingCompare from './PublicPricingCompare'
import PricingFaq from './PricingFaq'

export default function PublicPricingAudienceGroups({ plans, onCta }) {
  return (
    <div className="space-y-10">
      <PublicPricingCompare plans={plans} onCta={onCta} hideIntro />
      <PricingFaq />
    </div>
  )
}
