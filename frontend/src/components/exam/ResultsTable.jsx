import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

export default function ResultsTable({ results, examTitle }) {
  const exportExcel = () => {
    const data = results.map((r, i) => ({
      Yer: i + 1,
      Ad: r.full_name,
      Bal: r.score,
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
      doc.text(`${r.score}%`, 130, y)
      const dur = `${Math.floor(r.duration_seconds / 60)}:${String(r.duration_seconds % 60).padStart(2, '0')}`
      doc.text(dur, 160, y)
    })

    doc.save(`${examTitle}-neticeler.pdf`)
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <button
          onClick={exportExcel}
          className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-semibold hover:bg-emerald-500/30 transition-colors"
        >
          📊 Excel
        </button>
        <button
          onClick={exportPdf}
          className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-colors"
        >
          📄 PDF
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-indigo-500/20">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-500/20 text-gray-400 text-xs uppercase">
              <th className="py-3 px-4 text-left">Yer</th>
              <th className="py-3 px-4 text-left">Ad Soyad</th>
              <th className="py-3 px-4 text-left">Bal</th>
              <th className="py-3 px-4 text-left">Müddət</th>
              <th className="py-3 px-4 text-left">Tarix</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.id} className="border-b border-indigo-500/10 hover:bg-indigo-500/5 transition-colors">
                <td className="py-3 px-4">
                  <span className={`font-display font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                </td>
                <td className="py-3 px-4 font-medium text-white">{r.full_name}</td>
                <td className="py-3 px-4">
                  <span className={`font-display font-bold text-lg ${r.score >= 80 ? 'text-emerald-400' : r.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {r.score}%
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-400">
                  {Math.floor(r.duration_seconds / 60)} dəq {r.duration_seconds % 60} san
                </td>
                <td className="py-3 px-4 text-gray-500 text-xs">
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
