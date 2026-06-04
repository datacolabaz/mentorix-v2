import { useState } from 'react'
import api from '../../lib/api'
import Modal from '../common/Modal'
import Button from '../common/Button'

const FORMAT_OPTIONS = [
  { value: 'online', label: 'Onlayn' },
  { value: 'teacher_place', label: 'Müəllimin yanında' },
  { value: 'student_place', label: 'Mənim evimdə' },
]

export default function InquiryFormModal({ open, onClose, instructor, categoryId, categoryName }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [format, setFormat] = useState('online')
  const [level, setLevel] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/public/inquiries', {
        instructor_user_id: instructor?.id,
        requester_name: name.trim(),
        requester_phone: phone.trim(),
        category_id: categoryId || null,
        delivery_format: format,
        student_level: level.trim() || null,
        message: message.trim() || null,
      })
      if (res?.success) {
        setDone(true)
      } else {
        setError(res?.message || 'Göndərilmədi')
      }
    } catch (err) {
      setError(err?.message || 'Xəta')
    } finally {
      setLoading(false)
    }
  }

  const resetAndClose = () => {
    setDone(false)
    setName('')
    setPhone('')
    setLevel('')
    setMessage('')
    setError('')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={resetAndClose} title="Müraciət et" size="md">
      {done ? (
        <div className="space-y-4 text-center py-2">
          <p className="text-sm text-gray-300 leading-relaxed">
            Müraciətiniz <strong className="text-white">{instructor?.full_name}</strong> müəlliminə çatdırıldı.
          </p>
          <Button type="button" onClick={resetAndClose}>
            Bağla
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <p className="text-sm text-gray-400">
            <span className="text-white font-medium">{instructor?.full_name}</span>
            {categoryName ? <> · {categoryName}</> : null}
          </p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Adınız</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Telefon</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+994…"
              className="w-full rounded-lg border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dərs formatı</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Səviyyə (istəyə görə)</label>
            <input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Məs: 5-ci sinif, başlanğıc…"
              className="w-full rounded-lg border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Qısa mesaj</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white resize-none"
            />
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={resetAndClose}>
              Ləğv
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Göndər
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
