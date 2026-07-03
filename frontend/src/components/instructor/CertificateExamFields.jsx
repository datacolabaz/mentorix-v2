import { useTranslation } from 'react-i18next'
import { planRank } from '../../lib/subscriptionPlanGuards'

export default function CertificateExamFields({ meta, setMeta, billingPlan, templates = [] }) {
  const { t } = useTranslation()
  const proPlus = planRank(billingPlan) >= planRank('pro')

  if (!proPlus) {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        {t('certificates.proOnly', 'Sertifikat funksiyası Pro planında mövcuddur.')}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {t('certificates.exam.section', 'Sertifikat')}
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!meta.certificate_enabled}
            onChange={(e) => setMeta((p) => ({ ...p, certificate_enabled: e.target.checked }))}
          />
          {t('certificates.exam.enable', 'Keçənlərə sertifikat ver')}
        </label>
      </div>

      {meta.certificate_enabled ? (
        <>
          <label className="block text-sm">
            <span className="text-gray-400 text-xs uppercase">{t('certificates.exam.passScore', 'Keçid balı (%)')}</span>
            <input
              type="number"
              min={1}
              max={100}
              className="mt-1 w-full rounded-xl bg-[#13112e] border border-indigo-500/20 px-3 py-2 text-white text-sm"
              value={meta.certificate_pass_pct ?? 70}
              onChange={(e) => setSetNum(setMeta, 'certificate_pass_pct', e.target.value)}
            />
          </label>
          {templates.length > 0 ? (
            <label className="block text-sm">
              <span className="text-gray-400 text-xs uppercase">{t('certificates.exam.template', 'Şablon')}</span>
              <select
                className="mt-1 w-full rounded-xl bg-[#13112e] border border-indigo-500/20 px-3 py-2 text-white text-sm"
                value={meta.certificate_template_id || ''}
                onChange={(e) =>
                  setMeta((p) => ({
                    ...p,
                    certificate_template_id: e.target.value || null,
                  }))
                }
              >
                <option value="">{t('certificates.exam.defaultTemplate', 'Standart şablon')}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-[11px] text-gray-500">
            {t('certificates.exam.hint', 'Tələbə keçid balını keçəndə PDF sertifikat avtomatik yaradılır.')}
          </p>
        </>
      ) : null}
    </div>
  )
}

function setSetNum(setMeta, key, raw) {
  const n = Number(raw)
  setMeta((p) => ({ ...p, [key]: Number.isFinite(n) ? n : 70 }))
}
