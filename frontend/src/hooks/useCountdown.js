import { useState, useEffect, useCallback, useRef } from 'react'

const useCountdown = (endTime, onExpire, onWarning) => {
  const [remaining, setRemaining] = useState(0)
  const [warned, setWarned] = useState(false)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  const onWarningRef = useRef(onWarning)

  onExpireRef.current = onExpire
  onWarningRef.current = onWarning

  useEffect(() => {
    expiredRef.current = false
    setWarned(false)
    if (!endTime) return
    const endMs = new Date(endTime).getTime()
    if (!Number.isFinite(endMs)) return

    const tick = () => {
      const diff = endMs - Date.now()
      if (diff <= 0) {
        setRemaining(0)
        if (!expiredRef.current) {
          expiredRef.current = true
          onExpireRef.current?.()
        }
        return
      }
      setRemaining(diff)

      if (!warned && diff <= 60000) {
        setWarned(true)
        onWarningRef.current?.()
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
