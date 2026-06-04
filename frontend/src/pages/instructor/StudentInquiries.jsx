import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

const FORMAT_LABELS = {
  online: 'Onlayn',
  teacher_place: 'Müəllimin yanında',
  student_place: 'Tələbənin evində',
}

export default function StudentInquiries() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [inquiries, setInquiries] = useState([])
  const [usage, setUsage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/instructor/inquiries')
      if (res?.success) {
        setInquiries(Array.isArray(res.inquiries) ? res.inquiries : [])
        setUsage(res.usage || null)
      }
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const reveal = async (id) => {
    try {
      const res = await api.post(`/instructor/inquiries/${id}/reveal-contact`)
      if (res?.success) {
        toast(`Telefon: ${res.phone}`)
        await load()
      }
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-display font-bold text-white">Xəritə müraciətləri</h1>
        <p className="text-sm text-gray-400 mt-1">
          Mentorix axtarış/xəritədə profilinizi tapıb yazan valideyn və tələbələr. Qrup və imtahan təsdiqi üçün{' '}
          <Link to="/instructor/join-requests" className="text-primary hover:underline">
            Sorğular
          </Link>
          .{' '}
          <Link to="/instructor/settings#discover-profile" className="text-primary hover:underline">
            Axtarış profili
          </Link>
        </p>
      </div>

      {usage && !usage.premium ? (
        <p className="text-xs text-amber-400/90">
          Bu ay {usage.contacts_viewed_this_month}/{usage.monthly_limit} sorğu nömrəsi açılıb.
        </p>
      ) : null}

      <Card title="Son müraciətlər">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="text-sm text-gray-400 space-y-3">
            <p>Burada yalnız xəritə/axtarışdan gələn müraciətlər görünür — Gmail və ya imtahan linki ilə qoşulan tələbələr burada deyil.</p>
            <p>
              Dəvət linki və ya imtahan paylaşımından gələn təsdiq sorğuları:{' '}
              <Link to="/instructor/join-requests" className="text-primary hover:underline">
                Sorğular
              </Link>
              .
            </p>
            <p className="text-xs text-gray-500">
              Xəritədə görünmək üçün Tənzimləmələr → Axtarış profilini aktiv edin.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {inquiries.map((row) => (
              <li key={row.id} className="rounded-xl border border-white/10 p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-white">{row.requester_name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(row.created_at).toLocaleString('az-AZ')}
                  </span>
                </div>
                {row.category_name ? (
                  <p className="text-xs text-primary">{row.category_name}</p>
                ) : null}
                {row.delivery_format ? (
                  <p className="text-xs text-gray-400">
                    Format: {FORMAT_LABELS[row.delivery_format] || row.delivery_format}
                    {row.student_level ? ` · ${row.student_level}` : ''}
                  </p>
                ) : null}
                {row.message ? <p className="text-sm text-gray-300">{row.message}</p> : null}
                <p className="text-sm font-mono text-gray-200">
                  {row.phone_visible ? row.requester_phone : row.phone_masked}
                </p>
                {row.can_reveal_contact ? (
                  <Button type="button" variant="secondary" className="text-xs" onClick={() => void reveal(row.id)}>
                    Nömrəni göstər
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
