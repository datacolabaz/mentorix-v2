import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import { FEATURE_FLAGS, loadFeatureFlags } from '../../lib/featureFlags'
import { fmtAzBakuYmdHm } from '../../lib/azDatetime'

const FLAG_COPY = {
  [FEATURE_FLAGS.UNIVERSITY_SEARCH]: {
    title: 'Universitet axtarışı',
    hint: 'Proqram axtarışı, müraciətlər, müəllim töhfələri və həftəlik scraper.',
  },
  [FEATURE_FLAGS.MARKETPLACE]: {
    title: 'Müəllim marketplace-i',
    hint: 'Xəritə, kəşf, AI axtarış, axtarış müraciətləri, seçilmişlər və profil kəşf xəbərdarlıqları.',
  },
  [FEATURE_FLAGS.MENTOR_SERVICES]: {
    title: 'Mentor xidmətləri',
    hint: 'Mentor kabineti, mentorluq səhifələri və kabinet keçidində «Mentor». AI köməkçi buna daxil deyil.',
  },
  [FEATURE_FLAGS.LIVE_ROOM]: {
    title: 'Mentorix Live otağı',
    hint: 'Daxili video otaq (LiveKit), qonaq linkləri, otaq çatı və prezentasiya. Zoom/Google Meet dərsləri açıq qalır.',
  },
  [FEATURE_FLAGS.EXAM_RESULT_MODES]: {
    title: 'İmtahan nəticə rejimləri',
    hint: 'Söndürüləndə hər imtahan köhnə «Nəticələri göstər» davranışına qayıdır.',
  },
  [FEATURE_FLAGS.PROCTORING]: {
    title: 'Kamera ilə nəzarət (proctoring)',
    hint: 'Hələ hazır deyil. Məxfilik siyasəti və test mərhələsindən sonra ayrıca açılacaq.',
    locked: true,
  },
}

function flagTitle(key) {
  return FLAG_COPY[key]?.title || key
}

export default function AdminFeatureFlags() {
  const toast = useToast()
  const [flags, setFlags] = useState([])
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [flagRes, auditRes] = await Promise.all([
        api.get('/admin/feature-flags'),
        api.get('/admin/feature-flags/audit?limit=30'),
      ])
      setFlags(Array.isArray(flagRes?.flags) ? flagRes.flags : [])
      setAudit(Array.isArray(auditRes?.audit) ? auditRes.audit : [])
    } catch (e) {
      setError(e?.message || 'Funksiyalar yüklənmədi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const confirmToggle = async () => {
    if (!pending) return
    setSaving(true)
    try {
      await api.patch(`/admin/feature-flags/${encodeURIComponent(pending.key)}`, { enabled: pending.next })
      toast(`${flagTitle(pending.key)}: ${pending.next ? 'aktiv edildi' : 'söndürüldü'}`, 'success')
      setPending(null)
      await Promise.all([load(), loadFeatureFlags({ force: true })])
    } catch (e) {
      toast(e?.message || 'Dəyişiklik saxlanılmadı', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0">
      <div>
        <h1 className="font-display font-bold text-2xl text-token-textMain">Platforma funksiyaları</h1>
        <p className="text-token-textMuted text-sm mt-1 max-w-2xl">
          Söndürülmüş modul istifadəçi menyusundan, CTA-lardan və route-lardan gizlədilir. Məlumatlar silinmir; adminlər
          söndürülmüş səhifələri yoxlamaq üçün görə bilir.
        </p>
      </div>

      {error ? (
        <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Yenidən cəhd et
          </Button>
        </Card>
      ) : null}

      <Card className="divide-y divide-[color:var(--border-subtle)]">
        {loading ? (
          <div className="p-5 space-y-3" role="status">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          flags.map((flag) => {
            const copy = FLAG_COPY[flag.key] || {}
            const locked = copy.locked && !flag.enabled
            return (
              <div key={flag.key} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-token-textMain">{flagTitle(flag.key)}</span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                        flag.enabled
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-500/15 text-token-textMuted'
                      }`}
                    >
                      {flag.enabled ? 'Aktiv' : 'Söndürülüb'}
                    </span>
                  </div>
                  <p className="text-xs text-token-textMuted mt-1">{copy.hint || flag.description}</p>
                  <p className="text-[11px] text-token-textMuted/80 mt-1 font-mono break-all">{flag.key}</p>
                </div>
                {locked ? (
                  <span className="shrink-0 text-xs font-semibold text-token-textMuted px-3 py-1.5 rounded-lg border border-[color:var(--border-subtle)]">
                    Hazır deyil
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={flag.enabled ? 'secondary' : 'primary'}
                    onClick={() => setPending({ key: flag.key, next: !flag.enabled })}
                    className="shrink-0"
                  >
                    {flag.enabled ? 'Söndür' : 'Aktiv et'}
                  </Button>
                )}
              </div>
            )
          })
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[color:var(--border-subtle)]">
          <h2 className="font-display font-bold text-sm text-token-textMain">Dəyişiklik tarixçəsi</h2>
        </div>
        {!loading && !audit.length ? (
          <div className="text-center py-10 text-sm text-token-textMuted">Hələ dəyişiklik edilməyib</div>
        ) : (
          <ul className="divide-y divide-[color:var(--border-subtle)] text-sm">
            {audit.map((row) => (
              <li key={row.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-token-textMain">
                  <strong>{flagTitle(row.flag_key)}</strong> — {row.new_enabled ? 'aktiv edildi' : 'söndürüldü'}
                </span>
                <span className="text-xs text-token-textMuted">
                  {row.changed_by_name || 'Sistem'} · {fmtAzBakuYmdHm(row.changed_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => void confirmToggle()}
        loading={saving}
        danger={pending ? !pending.next : false}
        title={pending?.next ? 'Funksiyanı aktiv et' : 'Funksiyanı söndür'}
        message={
          pending
            ? pending.next
              ? `«${flagTitle(pending.key)}» bütün istifadəçilər üçün görünəcək.`
              : `«${flagTitle(pending.key)}» istifadəçilərdən gizlədiləcək. Məlumatlar qorunur.`
            : ''
        }
        confirmLabel={pending?.next ? 'Aktiv et' : 'Söndür'}
        cancelLabel="Ləğv et"
      />
    </div>
  )
}
