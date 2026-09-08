import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import ListSkeleton from '../../components/common/ListSkeleton'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'

export function OrgQuestionBank() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      const params = q ? `?q=${encodeURIComponent(q)}` : ''
      api
        .get(`/course/questions${params}`)
        .then((res) => setRows(res.questions || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <OrgPage
      title="Sual bankı"
      description="Təşkilat müəllimlərinin imtahanlarındakı təkrar istifadə olunan suallar. Şəxsi müəllim materialları ilə qarışmır."
    >
      <input
        className="max-w-sm rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
        placeholder="Axtarış"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <OrgPanel>
        {loading ? (
          <ListSkeleton />
        ) : (
          <OrgTable
            columns={[
              { key: 'question_text', label: 'Sual', render: (r) => String(r.question_text || '').slice(0, 140) },
              { key: 'question_type', label: 'Tip' },
              { key: 'subject', label: 'Fənn', render: (r) => r.subject || '—' },
              { key: 'exam_title', label: 'Mənbə imtahan' },
              { key: 'owner_name', label: 'Sahib' },
            ]}
            rows={rows}
            empty={<OrgEmpty>Sual bankı boşdur. Suallar təşkilat imtahanlarından toplanır.</OrgEmpty>}
          />
        )}
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgTests() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/exams')
      .then((res) => setRows(res.exams || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage
      title="Testlər"
      description="Təşkilat səviyyəsində testlər mövcud imtahan resurslarından gəlir. Yeni test müəllim panelində yaradılır."
    >
      <OrgPanel>
        <OrgTable
          columns={[
            { key: 'title', label: 'Test' },
            { key: 'created_by', label: 'Sahib' },
            { key: 'lifecycle', label: 'Status' },
            { key: 'participants', label: 'Təyinat' },
          ]}
          rows={rows}
          empty={<OrgEmpty>Test yoxdur.</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgTemplates() {
  return (
    <OrgPage title="İmtahan şablonları" description="Təkrar istifadə olunan assessment şablonları.">
      <OrgPanel>
        <OrgEmpty>
          İmtahan şablonları üçün ayrıca API hələ yoxdur. Mövcud imtahanları{' '}
          <Link className="text-emerald-300 hover:underline" to="/org/exams">
            təşkilat imtahanları
          </Link>{' '}
          siyahısından istifadə edin.
        </OrgEmpty>
      </OrgPanel>
    </OrgPage>
  )
}

export function OrgMaterials({ library = false }) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    api
      .get('/course/materials')
      .then((res) => setRows(res.materials || []))
      .catch(() => setRows([]))
  }, [])
  return (
    <OrgPage
      title={library ? 'Təşkilat kitabxanası' : 'Materiallar'}
      description="Təşkilat müəllimlərinin paylaşdığı fayllar. Müəllimin şəxsi kitabxanası ayrıca qalır."
    >
      <OrgPanel>
        <OrgTable
          columns={[
            { key: 'title', label: 'Material' },
            { key: 'owner_name', label: 'Sahib' },
            { key: 'file_type', label: 'Tip' },
            { key: 'original_filename', label: 'Fayl', render: (r) => r.original_filename || '—' },
          ]}
          rows={rows}
          empty={<OrgEmpty>Təşkilat kitabxanası boşdur.</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}
