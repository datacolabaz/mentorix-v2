import { useState, useEffect, useCallback } from 'react'

const useCountdown = (endTime, onExpire, onWarning) => {
  const [remaining, setRemaining] = useState(0)
  const [warned, setWarned] = useState(false)

  useEffect(() => {
    if (!endTime) return

    const tick = () => {
      const diff = new Date(endTime) - new Date()
      if (diff <= 0) {
        setRemaining(0)
        onExpire?.()
        return
      }
      setRemaining(diff)

      // 1 deqiqe qalanda xeberdar et
      if (!warned && diff <= 60000) {
        setWarned(true)
        onWarning?.()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [endTime, warned])

  const format = useCallback(() => {
    const m = Math.floor(remaining / 60000)
    const s = Math.floor((remaining % 60000) / 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [remaining])

  return { remaining, formatted: format(), isWarning: remaining <= 60000 && remaining > 0 }
}

export default useCountdown
