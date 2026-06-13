import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'

export default function AdminPayments() {
  const [instructors, setInstructors] = useState([])

  useEffect(() => {
    api.get('/admin/instructors').then(d => setInstructors(d.instructors || []))
  }, [])

  const totalStudents = instructors.reduce((s, i) => s + parseInt(i.student_count || 0), 0)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-token-textMain">Ödənişlər</h1>
        <p className="text-token-textMuted text-sm mt-1">Müəllimlərin tələbə sayı və limit vəziyyəti</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Ümumi Müəllim</div>
          <div className="font-display font-extrabold text-3xl text-primary">{instructors.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Ümumi Aktiv Tələbə</div>
          <div className="font-display font-extrabold text-3xl text-emerald-600 dark:text-emerald-400">{totalStudents}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[color:var(--border-subtle)]">
          <h2 className="font-display font-bold text-sm text-token-textMain">Müəllimlər üzrə Tələbə Vəziyyəti</h2>
        </div>
        <table className="w-full text-sm text-token-textMain">
          <thead>
            <tr className="border-b border-[color:var(--border-subtle)] text-token-textMuted text-xs uppercase">
              {['Müəllim', 'Fənn', 'Aktiv Tələbə', 'SMS İstifadəsi', 'Status'].map(h => (
                <th key={h} className="py-3 px-4 text-left font-semibold tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instructors.map(i => (
              <tr key={i.id} className="border-b border-[color:var(--border-subtle)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {i.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-token-textMain">{i.full_name}</div>
                      <div className="text-xs text-token-textMuted">{i.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-token-textMain">{i.subject || '—'}</td>
                <td className="py-4 px-4">
                  <span className="font-display font-bold text-lg text-token-textMain tabular-nums">{i.student_count || 0}</span>
                  <span className="text-token-textMuted text-xs ml-1">tələbə</span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full max-w-24">
                      <div className="h-full bg-primary rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            ((Number(i.sms_used_monthly ?? i.sms_used) || 0) /
                              Math.max(1, Number(i.sms_limit_monthly ?? i.sms_limit) || 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-token-textMuted tabular-nums">
                      {Number(i.sms_used_monthly ?? i.sms_used) || 0}/
                      {i.sms_limit_monthly ?? i.sms_limit ?? '∞'}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${i.is_active ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                    {i.is_active ? 'Aktiv' : 'Deaktiv'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!instructors.length && <div className="text-center py-12 text-token-textMuted">Müəllim tapılmadı</div>}
      </Card>
    </div>
  )
}
