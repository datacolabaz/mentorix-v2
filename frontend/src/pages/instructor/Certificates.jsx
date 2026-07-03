import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { useBillingStatus } from '../../hooks/useBillingStatus'
import { planRank } from '../../lib/subscriptionPlanGuards'

const TEMPLATE_KEYS = [
  { id: 'classic', label: 'Classic' },
  { id: 'modern', label: 'Modern' },
  { id: 'minimal', label: 'Minimal' },
]

export default function InstructorCertificates() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: billing } = useBillingStatus()
  const proPlus = planRank(billing?.plan) >= planRank('pro')

  const [certs, setCerts] = useState([])
  const [stats, setStats] = useState({ issued: 0, this_month: 0, all_time: 0 })
  const [form, setForm] = useState({
    name: 'Default',
    template_key: 'classic',
    accent_color: '#4f46e5',
    locale: 'az',
    logo_url: '',
    signature_url: '',
    is_default: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [overview, tplRes] = await Promise.all([
          api.get('/certificates/instructor'),
          api.get('/certificates/instructor/templates'),
        ])
        setCerts(overview?.certificates || [])
        setStats(overview?.stats || { issued: 0, this_month: 0, all_time: 0 })
        const templates = tplRes?.templates || []
        const def = templates.find((x) => x.is_default) || templates[0]
        if (def) {
          setForm({
            id: def.id,
            name: def.name,
            template_key: def.template_key || 'classic',
            accent_color: def.accent_color || '#4f46e5',
            locale: def.locale || 'az',
            logo_url: def.logo_url || '',
            signature_url: def.signature_url || '',
            is_default: !!def.is_default,
          })
        }
      } catch (e) {
        toast(e?.message || 'Yüklənmədi', 'error')
      }
    })()
  }, [toast])

  const saveTemplate = async () => {
    if (!proPlus) {
      toast(t('certificates.proOnly', 'Sertifikat funksiyası Pro planında mövcuddur'), 'error')
      return
    }
    setSaving(true)
    try {
      const r = await api.post('/certificates/instructor/templates', form)
      toast(t('certificates.templateSaved', 'Şablon saxlanıldı'), 'success')
      if (r?.template) {
        setForm((p) => ({ ...p, id: r.template.id }))
      }
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('certificates.instructor.title', 'Sertifikatlar')}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t('certificates.instructor.subtitle', 'İmtahan keçən tələbələrə avtomatik sertifikat verin.')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t('certificates.instructor.issued', 'Buraxılıb')}</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.issued ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t('certificates.instructor.thisMonth', 'Bu ay')}</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.this_month ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t('certificates.instructor.allTime', 'Ümumi')}</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.all_time ?? 0}</p>
        </Card>
      </div>

      {!proPlus ? (
        <Card className="p-4 border-amber-500/30 bg-amber-500/10 text-amber-100 text-sm">
          {t('certificates.proOnly', 'Sertifikat funksiyası Pro planında mövcuddur. Parametrlərdən planı yüksəldin.')}
        </Card>
      ) : null}

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-white">{t('certificates.instructor.template', 'Sertifikat şablonu')}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-400 text-xs uppercase">{t('certificates.instructor.templateName', 'Ad')}</span>
            <input
              className="mt-1 w-full rounded-xl bg-[#13112e] border border-indigo-500/20 px-3 py-2 text-white text-sm"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-400 text-xs uppercase">{t('certificates.instructor.style', 'Stil')}</span>
            <select
              className="mt-1 w-full rounded-xl bg-[#13112e] border border-indigo-500/20 px-3 py-2 text-white text-sm"
              value={form.template_key}
              onChange={(e) => setForm((p) => ({ ...p, template_key: e.target.value }))}
            >
              {TEMPLATE_KEYS.map((tk) => (
                <option key={tk.id} value={tk.id}>
                  {tk.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-400 text-xs uppercase">{t('certificates.instructor.accent', 'Rəng')}</span>
            <input
              type="color"
              className="mt-1 h-10 w-full rounded-xl border border-indigo-500/20 bg-transparent"
              value={form.accent_color}
              onChange={(e) => setForm((p) => ({ ...p, accent_color: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-400 text-xs uppercase">{t('certificates.instructor.locale', 'Dil')}</span>
            <select
              className="mt-1 w-full rounded-xl bg-[#13112e] border border-indigo-500/20 px-3 py-2 text-white text-sm"
              value={form.locale}
              onChange={(e) => setForm((p) => ({ ...p, locale: e.target.value }))}
            >
              <option value="az">AZ</option>
              <option value="en">EN</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-400 text-xs uppercase">{t('certificates.instructor.logoUrl', 'Logo URL')}</span>
            <input
              className="mt-1 w-full rounded-xl bg-[#13112e] border border-indigo-500/20 px-3 py-2 text-white text-sm"
              value={form.logo_url}
              onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-400 text-xs uppercase">{t('certificates.instructor.signatureUrl', 'İmza URL')}</span>
            <input
              className="mt-1 w-full rounded-xl bg-[#13112e] border border-indigo-500/20 px-3 py-2 text-white text-sm"
              value={form.signature_url}
              onChange={(e) => setForm((p) => ({ ...p, signature_url: e.target.value }))}
              placeholder="https://..."
            />
          </label>
        </div>
        <Button onClick={() => void saveTemplate()} loading={saving} disabled={!proPlus}>
          {t('certificates.instructor.saveTemplate', 'Şablonu saxla')}
        </Button>
        <p className="text-xs text-gray-500">
          {t(
            'certificates.instructor.examHint',
            'İmtahan yaradarkən «Sertifikat ver» seçimini aktiv edin və keçid balını təyin edin.',
          )}
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-white mb-3">{t('certificates.instructor.list', 'Buraxılmış sertifikatlar')}</h2>
        {certs.length === 0 ? (
          <p className="text-sm text-gray-500">{t('certificates.instructor.empty', 'Hələ sertifikat yoxdur.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-white/10">
                  <th className="py-2 pr-3">{t('certificates.instructor.student', 'Tələbə')}</th>
                  <th className="py-2 pr-3">{t('certificates.instructor.course', 'Kurs')}</th>
                  <th className="py-2 pr-3">{t('certificates.score', 'Bal')}</th>
                  <th className="py-2">{t('certificates.verify.date', 'Tarix')}</th>
                </tr>
              </thead>
              <tbody>
                {certs.slice(0, 50).map((c) => (
                  <tr key={c.id} className="border-b border-white/5 text-gray-200">
                    <td className="py-2 pr-3">{c.student_name}</td>
                    <td className="py-2 pr-3">{c.title}</td>
                    <td className="py-2 pr-3">{Number(c.score_pct || 0).toFixed(0)}%</td>
                    <td className="py-2">{c.issued_at ? new Date(c.issued_at).toLocaleDateString('az-AZ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
