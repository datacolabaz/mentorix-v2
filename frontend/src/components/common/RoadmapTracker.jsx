import { useState } from 'react'
import Card from './Card'

export default function RoadmapTracker({
  title = 'Junior Frontend / Data Analyst Roluna Hazırlıq',
  initialProgress = 60,
}) {
  const [stages, setStages] = useState([
    {
      id: 1,
      title: '1. Mərhələ: Kod və Memarlıq Konsepsiyası ("Danış")',
      status: 'completed',
      tasks: [
        { id: 101, text: 'React State və Lifecycle konsepsiyasının müzakirəsi', done: true },
        { id: 102, text: 'Mentor tərəfindən tövsiyə olunan 2 arxitektura məqaləsinin oxunması', done: true },
      ],
    },
    {
      id: 2,
      title: '2. Mərhələ: Praktiki Nümayiş və Analiz ("Göstər")',
      status: 'in_progress',
      tasks: [
        { id: 201, text: 'Mentorun canlı kodlama nümayişi (Live Coding / Pair Programming)', done: true },
        { id: 202, text: 'Keçirilmiş 1-on-1 sessiya qeydlərinin və səhvlərin nəzərdən keçirilməsi', done: false },
      ],
    },
    {
      id: 3,
      title: '3. Mərhələ: Sərbəst Layihə İcrası və Tənqidi Rəy ("Et")',
      status: 'pending',
      tasks: [
        { id: 301, text: 'E-ticarət səhifəsinin UI komponentlərinin və API əlaqəsinin sıfırdan yığılması', done: false },
        { id: 302, text: 'Mentor tərəfindən Code Review və konstruktiv rəyin (Feedback) verilməsi', done: false },
      ],
    },
  ])

  const toggleTask = (stageId, taskId) => {
    setStages((prev) =>
      prev.map((stage) => {
        if (stage.id !== stageId) return stage
        const updatedTasks = stage.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
        const allDone = updatedTasks.every((t) => t.done)
        const anyDone = updatedTasks.some((t) => t.done)
        return {
          ...stage,
          tasks: updatedTasks,
          status: allDone ? 'completed' : anyDone ? 'in_progress' : 'pending',
        }
      }),
    )
  }

  // Calculate live progress percentage
  const totalTasks = stages.flatMap((s) => s.tasks).length
  const completedTasks = stages.flatMap((s) => s.tasks).filter((t) => t.done).length
  const liveProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : initialProgress

  return (
    <div className="space-y-5">
      {/* HEADER STATS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-token-border bg-token-surface shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded-full">
            🎯 AKTİV YOL XƏRİTƏSİ
          </span>
          <h3 className="text-base sm:text-lg font-bold text-token-text mt-1.5">{title}</h3>
          <p className="text-xs text-token-textMuted mt-0.5">Start: 1 Oktyabr 2026 · Hədəf: 31 Dekabr 2026</p>
        </div>

        <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {liveProgress}%
          </div>
          <div className="text-xs text-token-textMuted font-medium">Ümumi Tərəqqi</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-token-surfaceHover rounded-full h-2 overflow-hidden">
        <div
          className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${liveProgress}%` }}
        />
      </div>

      {/* STAGES & TASKS */}
      <div className="space-y-4">
        {stages.map((stage) => {
          const isDone = stage.status === 'completed'
          const isInProgress = stage.status === 'in_progress'

          return (
            <Card
              key={stage.id}
              className={[
                'p-5 transition-all space-y-3',
                isInProgress ? 'border-l-4 border-l-emerald-500' : isDone ? 'border-l-4 border-l-emerald-300 opacity-90' : '',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-token-text flex items-center gap-2">
                  <span>{isDone ? '✅' : isInProgress ? '⏳' : '📌'}</span>
                  <span>{stage.title}</span>
                </h4>
                <span
                  className={[
                    'text-xs font-semibold px-2.5 py-0.5 rounded-full',
                    isDone
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : isInProgress
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-token-surfaceHover text-token-textMuted',
                  ].join(' ')}
                >
                  {isDone ? 'Tamamlandı' : isInProgress ? 'İcradadır' : 'Gözləyir'}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {stage.tasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-start gap-2.5 text-xs text-token-text cursor-pointer hover:bg-token-surfaceHover/50 p-1.5 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(stage.id, task.id)}
                      className="mt-0.5 rounded border-token-border text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className={task.done ? 'line-through text-token-textMuted' : 'font-medium'}>
                      {task.text}
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
