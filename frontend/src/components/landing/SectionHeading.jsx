export default function SectionHeading({ id, kicker, title, lead, align = 'center' }) {
  const centered = align === 'center'
  return (
    <div className={`mb-10 max-w-2xl sm:mb-12 ${centered ? 'mx-auto text-center' : ''}`}>
      {kicker ? <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-brand-text">{kicker}</p> : null}
      <h2 id={id} className="text-h2 text-fg">
        {title}
      </h2>
      {lead ? <p className={`mt-4 text-body-lg text-fg-secondary ${centered ? 'mx-auto' : ''}`}>{lead}</p> : null}
    </div>
  )
}
