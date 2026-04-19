import { useState } from 'react'
import useCountdown from '../../hooks/useCountdown'

export default function Countdown({ endTime, onExpire, className = '' }) {
  const [showWarning, setShowWarning] = useState(false)

  const { formatted, isWarning } = useCountdown(
    endTime,
    onExpire,
    () => setShowWarning(true)
  )

  return (
    <>
      <div className={`text-center shrink-0 ${isWarning ? 'animate-pulse' : ''} ${className}`}>
        <div
          className={`font-display font-extrabold text-2xl sm:text-3xl md:text-4xl tabular-nums leading-none ${
            isWarning ? 'text-red-400' : 'text-cyan-400'
          }`}
        >
          {formatted}
        </div>
        <div className="text-[10px] sm:text-xs text-gray-500 mt-1">qalıb</div>
      </div>

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-red-900/80 border-2 border-red-500 rounded-2xl p-8 text-center max-w-sm mx-4 animate-bounce-once">
            <div className="text-4xl mb-4">⚠️</div>
            <div className="font-display font-bold text-xl text-white mb-2">
              Son 1 dəqiqə!
            </div>
            <div className="text-red-300 text-sm mb-6">
              İmtahanın bitməsinə son 1 dəqiqə qalıb. Cavablarınızı yoxlayın!
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-semibold transition-colors"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  )
}
