import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import StatusBadge from '../common/StatusBadge'

function rowPct(r) {
  if (r.score_pct != null && Number.isFinite(Number(r.score_pct))) {
    return Math.min(100, Math.max(0, Math.round(Number(r.score_pct))))
  }
  return Math.min(100, Math.round(Number(r.score) || 0))
}

export default function ResultsTable({ results, examTitle }) {
  const exportExcel = () => {
    const data = results.map((r, i) => ({
      Yer: i + 1,
      Ad: r.full_name,
      'Xal (toplam)': r.score,
      'Faiz (%)': rowPct(r),
      Müddət: `${Math.floor(r.duration_seconds / 60)} dəq ${r.duration_seconds % 60} san`,
      Tarix: new Date(r.submitted_at).toLocaleString('az-AZ'),
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nəticələr')
    XLSX.writeFile(wb, `${examTitle}-neticeler.xlsx`)
  }

  const exportPdf = () => {
    const doc = new jsPDF()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(examTitle + ' - Nəticələr', 14, 20)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    results.forEach((r, i) => {
      const y = 35 + i * 10
      doc.text(`${i + 1}. ${r.full_name}`, 14, y)
      doc.text(`${rowPct(r)}%`, 130, y)
      const dur = `${Math.floor(r.duration_seconds / 60)}:${String(r.duration_seconds % 60).padStart(2, '0')}`
      doc.text(dur, 160, y)
    })

    doc.save(`${examTitle}-neticeler.pdf`)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0 flex items-center gap-2">
          <div className="text-sm font-semibold text-white/90 truncate">Nəticələr</div>
          <StatusBadge variant="neutral" className="shrink-0">
            {results?.length || 0} tələbə
          </StatusBadge>
        </div>
        <div className="flex gap-2 shrink-0">
        <button
          onClick={exportExcel}
          className="px-3 py-2 bg-emerald-500/12 text-emerald-200 border border-emerald-400/20 rounded-xl text-sm font-semibold hover:bg-emerald-500/18 transition-[background-color,transform] duration-200 ease-out hover:scale-[1.01]"
        >
          📊 Excel
        </button>
        <button
          onClick={exportPdf}
          className="px-3 py-2 bg-red-500/12 text-red-200 border border-red-400/20 rounded-xl text-sm font-semibold hover:bg-red-500/18 transition-[background-color,transform] duration-200 ease-out hover:scale-[1.01]"
        >
          📄 PDF
        </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-[11px] uppercase tracking-wider">
              <th className="py-3.5 px-4 text-left">Yer</th>
              <th className="py-3.5 px-4 text-left">Ad Soyad</th>
              <th className="py-3.5 px-4 text-left">Faiz</th>
              <th className="py-3.5 px-4 text-left">Müddət</th>
              <th className="py-3.5 px-4 text-right">Tarix</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr
                key={r.id}
                className="border-b border-white/5 hover:bg-white/[0.04] transition-[background-color] duration-200"
              >
                <td className="py-3.5 px-4">
                  <span className={`font-display font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-white truncate">{r.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">ID: {r.student_id ?? '—'}</div>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`font-display font-bold text-lg ${
                      rowPct(r) >= 80 ? 'text-emerald-400' : rowPct(r) >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}
                  >
                    {rowPct(r)}%
                  </span>
                </td>
                <td className="py-3.5 px-4 text-gray-400 tabular-nums">
                  {Math.floor(r.duration_seconds / 60)} dəq {r.duration_seconds % 60} san
                </td>
                <td className="py-3.5 px-4 text-gray-500 text-xs text-right whitespace-nowrap">
                  {new Date(r.submitted_at).toLocaleString('az-AZ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
