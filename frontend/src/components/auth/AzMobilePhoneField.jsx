import { useCallback, useState } from 'react'
import { canonicalAzPhoneE164, isValidAzMobileNational, nationalFromE164, onlyDigits } from '../../lib/azPhone'

function digitsFromE164(value) {
  return onlyDigits(nationalFromE164(value)).slice(0, 9)
}

function e164FromDigits(digits) {
  const d = onlyDigits(digits).slice(0, 9)
  if (!d) return ''
  return canonicalAzPhoneE164(`+994${d}`) || `+994${d}`
}

/**
 * OTP / təsdiq axınları üçün sadə AZ mobil input.
 * PhoneInput maskası iOS Safari-də controlled input-u pozur — burada yalnız 9 rəqəm.
 */
export default function AzMobilePhoneField({
  defaultE164 = '',
  onE164Change,
  inputId = 'az-mobile-phone',
  className,
}) {
  const [digits, setDigits] = useState(() => digitsFromE164(defaultE164))

  const emit = useCallback(
    (nextDigits) => {
      const d = onlyDigits(nextDigits).slice(0, 9)
      setDigits(d)
      onE164Change?.(e164FromDigits(d))
    },
    [onE164Change],
  )

  const invalid = digits.length > 0 && (digits.length !== 9 || !isValidAzMobileNational(digits))

  return (
    <div className={['mx-az-mobile-field', className].filter(Boolean).join(' ')}>
      <div className="flex items-stretch gap-2">
        <div
          className="shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[48px] rounded-xl bg-[#13112e] border border-indigo-500/20 text-gray-200 text-sm"
          aria-hidden
        >
          <span className="text-base leading-none">🇦🇿</span>
          <span className="font-mono text-xs tabular-nums">+994</span>
        </div>

        <input
          id={inputId}
          name={inputId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="tel-national"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          required
          className="mx-phone-input-native flex-1 min-w-0 bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white font-mono tabular-nums outline-none focus:border-blue-500 min-h-[48px]"
          style={{ fontSize: '16px', WebkitAppearance: 'none', appearance: 'none' }}
          placeholder="501234567"
          value={digits}
          maxLength={9}
          onChange={(e) => emit(e.target.value)}
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
