import { useTranslation } from 'react-i18next'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const DATA = [
  { week: '1', lessons: 8 },
  { week: '2', lessons: 13 },
  { week: '3', lessons: 7 },
  { week: '4', lessons: 16 },
  { week: '5', lessons: 11 },
  { week: '6', lessons: 18 },
  { week: '7', lessons: 10 },
]

export default function LandingDemoActivityChart({ compact = false }) {
  const { t } = useTranslation()
  return (
    <div className={`rounded-xl border border-white/10 bg-[#151515] ${compact ? 'p-2.5 space-y-1.5' : 'p-3 space-y-2'}`}>
      <div className="text-[11px] font-semibold text-gray-200">{t('landing.demo.chartTitle')}</div>
      <div className={`w-full ${compact ? 'h-24 min-h-[6rem]' : 'h-28 min-h-[7rem]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <XAxis
              dataKey="week"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, 'dataMax + 4']} />
            <Bar dataKey="lessons" fill="#00e5b0" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{t('landing.demo.chartCaption')}</span>
        <span className="text-primary/80">{t('landing.demo.sampleData')}</span>
      </div>
    </div>
  )
}
