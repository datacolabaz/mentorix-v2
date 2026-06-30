/** Plan kartı feature sətri — "Record: ✓ (local)" badge-i ayrıca nowrap saxlayır. */
const LIVE_RECORD_SPLIT = /\s·\s(?=(?:Record|Запись):)/i

export default function PricingFeatureListItem({ line, isBasicTrial = false }) {
  const recordParts = line.split(LIVE_RECORD_SPLIT)
  const hasRecordBadge = recordParts.length === 2

  const body = hasRecordBadge ? (
    <div className="flex flex-1 min-w-0 items-center justify-between gap-2 flex-wrap">
      <span className="min-w-0 leading-relaxed break-words">{recordParts[0]}</span>
      <span className="whitespace-nowrap shrink-0 leading-relaxed">{recordParts[1]}</span>
    </div>
  ) : (
    <span className="min-w-0 leading-relaxed break-words">{line}</span>
  )

  if (isBasicTrial) {
    return (
      <li className="pricing-feature flex items-start gap-1.5 min-w-0">
        <span className="text-primary shrink-0 font-semibold leading-none mt-px">✓</span>
        {body}
      </li>
    )
  }

  return (
    <li className="pricing-feature flex items-start gap-1 min-w-0">
      <span className="text-gray-400 shrink-0">•</span>
      {body}
    </li>
  )
}
