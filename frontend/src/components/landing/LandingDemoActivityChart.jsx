import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const DATA = [
  { week: 'H1', lessons: 8 },
  { week: 'H2', lessons: 13 },
  { week: 'H3', lessons: 7 },
  { week: 'H4', lessons: 16 },
  { week: 'H5', lessons: 11 },
  { week: 'H6', lessons: 18 },
  { week: 'H7', lessons: 10 },
]

export default function LandingDemoActivityChart() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#151515] p-3 space-y-2">
      <div className="text-xs font-semibold text-gray-200">Bu ay — yüklənmə ritmi</div>
      <div className="h-28 w-full min-h-[7rem]">
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
        <span>Həftəlik dərs sayı</span>
        <span className="text-primary/80">nümunə data</span>
      </div>
    </div>
  )
}
