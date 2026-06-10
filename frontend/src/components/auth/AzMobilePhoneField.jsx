import { useCallback, useRef, useState } from 'react'
import { canonicalAzPhoneE164, isValidAzMobileNational, nationalFromE164, onlyDigits } from '../../lib/azPhone'

function digitsFromE164(value) {
  return onlyDigits(nationalFromE164(value)).slice(0, 9)
}

function e164FromDigits(digits) {
  const d = onlyDigits(digits).slice(0, 9)
  if (!d) return ''
  return canonicalAzPhoneE164(`+994${d}`) || `+994${d}`
}

function isIosLike() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/**
 * OTP / təsdiq axınları — iOS Safari üçün uncontrolled input + readOnly unlock.
 */
export default function AzMobilePhoneField({
  defaultE164 = '',
  onE164Change,
  inputId = 'az-mobile-phone',
  className,
}) {
  const inputRef = useRef(null)
  const [displayDigits, setDisplayDigits] = useState(() => digitsFromE164(defaultE164))
  const [iosLocked, setIosLocked] = useState(() => isIosLike())

  const unlockAndFocus = useCallback(() => {
    setIosLocked(false)
    const el = inputRef.current
    if (!el) return
    window.setTimeout(() => {
      try {
        el.focus({ preventScroll: true })
      } catch {
        el.focus()
      }
    }, 0)
  }, [])

  const handleInput = useCallback(
    (e) => {
      const d = onlyDigits(e.target.value).slice(0, 9)
      if (e.target.value !== d) e.target.value = d
      setDisplayDigits(d)
      onE164Change?.(e164FromDigits(d))
    },
    [onE164Change],
  )

  const invalid = displayDigits.length > 0 && (displayDigits.length !== 9 || !isValidAzMobileNational(displayDigits))

  return (
    <div className={['mx-az-mobile-field', className].filter(Boolean).join(' ')}>
      <div className="flex items-stretch gap-2">
        <div
          className="shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[48px] rounded-xl bg-[#13112e] border border-indigo-500/20 text-gray-200 text-sm select-none"
          aria-hidden
        >
          <span className="text-base leading-none">🇦🇿</span>
          <span className="font-mono text-xs tabular-nums">+994</span>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          name={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="tel-national"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          required
          readOnly={iosLocked}
          defaultValue={digitsFromE164(defaultE164)}
          className="mx-auth-tel-input flex-1 min-w-0 rounded-xl px-4 py-3 font-mono tabular-nums outline-none min-h-[48px]"
          placeholder="501234567"
          maxLength={9}
          onTouchStart={unlockAndFocus}
          onClick={unlockAndFocus}
          onFocus={unlockAndFocus}
          onInput={handleInput}
          onChange={handleInput}
        />
      </div>
      <div className="min-h-[1.35rem] mt-1.5">
        {invalid ? (
          <p className="text-xs text-red-400/95">
            Mobil nömrə 9 rəqəm olmalıdır (məs: 501234567). Operator: 50, 51, 55, 70, 77 və s.
          </p>
        ) : null}
      </div>
    </div>
  )
}
