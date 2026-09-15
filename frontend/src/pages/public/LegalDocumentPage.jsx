import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import { setPageSeo } from '../../lib/pageSeo'

const CONTACT_EMAIL = 'datacolabaz@gmail.com'
const SUPPORT_EMAIL = 'support@mentorix.io'

/**
 * Public legal pages for Google OAuth branding (/privacy, /terms).
 * No auth required.
 */
export default function LegalDocumentPage({ doc }) {
  const { t, i18n } = useTranslation()
  const isPrivacy = doc === 'privacy'
  const ns = isPrivacy ? 'legal.privacy' : 'legal.terms'
  const path = isPrivacy ? '/privacy' : '/terms'
  const title = t(`${ns}.title`)
  const updated = t(`${ns}.updated`)
  const sections = t(`${ns}.sections`, { returnObjects: true })
  const sectionList = Array.isArray(sections) ? sections : []

  useEffect(() => {
    setPageSeo({
      title: t(`${ns}.seoTitle`),
      description: t(`${ns}.seoDesc`),
      canonicalPath: path,
      breadcrumbs: [
        { name: 'Mentorix', path: '/' },
        { name: title, path },
      ],
    })
  }, [ns, path, t, title, i18n.language])

  return (
    <div className="min-h-[100svh] bg-[#f4f6fb] text-slate-800 flex flex-col">
      <PublicMarketingNav />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 w-full">
        <Link
          to="/"
          className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← {t('legal.backHome')}
        </Link>

        <header className="mt-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            Mentorix · {t('legal.eyebrow')}
          </p>
          <h1 className="text-[1.85rem] sm:text-4xl font-bold tracking-tight leading-tight text-slate-900">
            {title}
          </h1>
          <p className="text-sm text-slate-500">{updated}</p>
        </header>

        <div className="mt-8 space-y-8 text-base leading-relaxed text-slate-700">
          {sectionList.map((section, idx) => (
            <section key={idx} className="space-y-3">
              {section.heading ? (
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">{section.heading}</h2>
              ) : null}
              {Array.isArray(section.paragraphs)
                ? section.paragraphs.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))
                : null}
              {Array.isArray(section.bullets) && section.bullets.length ? (
                <ul className="list-disc pl-5 space-y-2">
                  {section.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 space-y-2">
            <h2 className="text-lg font-bold text-slate-900">{t('legal.contactHeading')}</h2>
            <p>
              {t('legal.contactBody')}{' '}
              <a className="text-emerald-700 font-semibold hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              {' · '}
              <a className="text-emerald-700 font-semibold hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p className="text-sm text-slate-500">{t('legal.companyLine')}</p>
          </section>

          <p className="text-sm text-slate-500">
            {isPrivacy ? (
              <>
                {t('legal.seeAlso')}{' '}
                <Link to="/terms" className="text-emerald-700 font-semibold hover:underline">
                  {t('legal.termsLink')}
                </Link>
              </>
            ) : (
              <>
                {t('legal.seeAlso')}{' '}
                <Link to="/privacy" className="text-emerald-700 font-semibold hover:underline">
                  {t('legal.privacyLink')}
                </Link>
              </>
            )}
          </p>
        </div>
      </main>

      <PublicSeoFooter />
    </div>
  )
}
