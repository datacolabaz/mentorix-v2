import { useEffect, useMemo, useRef, useState } from 'react'
import { canonicalAzPhoneE164, isValidAzMobileNational, onlyDigits as azOnlyDigits } from '../../lib/azPhone'

const STORAGE_COUNTRY = 'mx_login_country'
const STORAGE_PHONE = 'mx_login_phone'

const COUNTRIES = [
  { id: 'AZ', name: 'Azərbaycan', dial: '994', flag: '🇦🇿', mask: 'XX XX XX XX', max: 9 },
  { id: 'TR', name: 'Türkiyə', dial: '90', flag: '🇹🇷', mask: 'XXX XXX XX XX', max: 10 },
  { id: 'US', name: 'ABŞ', dial: '1', flag: '🇺🇸', mask: 'XXX XXX XXXX', max: 10 },
  { id: 'RU', name: 'Rusiya', dial: '7', flag: '🇷🇺', mask: 'XXX XXX XX XX', max: 10 },
  { id: 'GE', name: 'Gürcüstan', dial: '995', flag: '🇬🇪', mask: 'XXX XX XX XX', max: 9 },
]

function onlyDigits(s) {
  return azOnlyDigits(s)
}

function pickCountryByDial(digits) {
  const list = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)
  return list.find((c) => digits.startsWith(c.dial)) || null
}

function normalizeNationalDigits(countryId, digits) {
  const d = onlyDigits(digits)
  if (countryId === 'AZ') {
    let x = d
    if (x.startsWith('994')) x = x.slice(3)
    if (x.startsWith('0')) x = x.slice(1)
    return x.slice(0, 9)
  }
  const meta = COUNTRIES.find((c) => c && c.id === countryId) || null
  const max = meta?.max ?? 15
  return d.slice(0, max)
}

function formatNationalDisplay(countryId, nationalDigits) {
  const n = onlyDigits(nationalDigits)
  if (!n) return ''
  if (countryId === 'AZ') {
    const a = n.slice(0, 2)
    const b = n.slice(2, 5)
    const c = n.slice(5, 7)
    const d = n.slice(7, 9)
    return [a, b, c, d].filter(Boolean).join(' ')
  }
  const meta = COUNTRIES.find((c) => c && c.id === countryId)
  const max = meta?.max ?? 15
  const x = n.slice(0, max)
  if (x.length <= 3) return x
  if (x.length <= 6) return `${x.slice(0, 3)} ${x.slice(3)}`
  return `${x.slice(0, 3)} ${x.slice(3, 6)} ${x.slice(6)}`
}

function e164(country, nationalDigits) {
  const dial = String(country?.dial || '').trim()
  const n = onlyDigits(nationalDigits)
  if (!dial || !n) return ''
  return `+${dial}${n}`
}

function nationalFromPropValue(incoming) {
  const raw = String(incoming || '').trim()
  if (!raw) return { country: null, national: '' }
  const d = onlyDigits(raw)
  const found = pickCountryByDial(d)
  if (found) {
    return {
      country: found,
      national: normalizeNationalDigits(found.id, d.slice(found.dial.length)),
    }
  }
  return { country: COUNTRIES[0], national: normalizeNationalDigits('AZ', d) }
}

function outboundFromNational(countryId, country, national) {
  const n = onlyDigits(national)
  if (!n) return ''
  const full = e164(country || COUNTRIES[0], n)
  if (countryId === 'AZ') {
    if (n.length < 9) return `+994${n}`
    return canonicalAzPhoneE164(full) || `+994${n}`
  }
  return full
}

function caretAfterDigitIndex(masked, digitIndex) {
  if (digitIndex <= 0) return 0
  let seen = 0
  for (let i = 0; i < masked.length; i++) {
    if (/\d/.test(masked[i])) seen += 1
    if (seen >= digitIndex) return i + 1
  }
  return masked.length
}

export default function PhoneInput({
  value,
  onChange,
  className,
  placeholder,
  autoFocus,
  required,
  persistLoginDefaults = true,
  inputId = 'mx-phone-input',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const lastEmitted = useRef(undefined)
  const prevPropValue = useRef(undefined)
  const didHydrateFromStorage = useRef(false)

  const initialCountry = useMemo(() => {
    const saved =
      persistLoginDefaults && typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_COUNTRY)
        : null
    const c = saved ? COUNTRIES.find((x) => x && x.id === saved) : null
    return c || COUNTRIES[0]
  }, [persistLoginDefaults])

  const [country, setCountry] = useState(initialCountry)
  const [national, setNational] = useState('')

  useEffect(() => {
    if (didHydrateFromStorage.current) return
    const incoming = String(value || '').trim()
    if (incoming) {
      didHydrateFromStorage.current = true
      return
    }
    if (!persistLoginDefaults) {
      didHydrateFromStorage.current = true
      return
    }
    const savedPhone = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PHONE) : null
    if (savedPhone) {
      const parsed = nationalFromPropValue(savedPhone)
      if (parsed.country) setCountry(parsed.country)
      setNational(parsed.national)
    }
    didHydrateFromStorage.current = true
  }, [value, persistLoginDefaults])

  useEffect(() => {
    const incoming = String(value || '').trim()
    if (prevPropValue.current === incoming) return
    const prev = prevPropValue.current
    prevPropValue.current = incoming

    if (incoming) {
      const parsed = nationalFromPropValue(incoming)
      const nextNational = parsed.national
      if (onlyDigits(nextNational) !== onlyDigits(national)) {
        setNational(nextNational)
      }
      if (parsed.country && parsed.country.id !== country?.id) {
        setCountry(parsed.country)
      }
      lastEmitted.current = incoming
      return
    }
    if (prev === undefined) return
    if (onlyDigits(national).length > 0) return
    setNational('')
  }, [value, national, country?.id])

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!autoFocus || !inputRef.current) return undefined
    const t = window.setTimeout(() => {
      try {
        inputRef.current?.focus({ preventScroll: true })
      } catch {
        inputRef.current?.focus()
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [autoFocus])

  useEffect(() => {
    if (!open) return undefined
    const onScroll = () => setOpen(false)
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open])

  const list = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c &&
        (c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.id.toLowerCase().includes(q)),
    )
  }, [query])

  const countryId = country?.id || COUNTRIES[0]?.id || 'AZ'

  const masked = useMemo(() => formatNationalDisplay(countryId, national), [countryId, national])

  const outboundE164 = useMemo(
    () => outboundFromNational(countryId, country, national),
    [countryId, country, national],
  )

  const azInvalid =
    countryId === 'AZ' &&
    onlyDigits(national).length > 0 &&
    (onlyDigits(national).length !== 9 || !isValidAzMobileNational(national))

  useEffect(() => {
    if (typeof onChange !== 'function') return
    if (lastEmitted.current === outboundE164) return
    lastEmitted.current = outboundE164
    onChange(outboundE164)
    if (!persistLoginDefaults) return
    try {
      localStorage.setItem(STORAGE_COUNTRY, country?.id || 'AZ')
      if (outboundE164) localStorage.setItem(STORAGE_PHONE, outboundE164)
      else localStorage.removeItem(STORAGE_PHONE)
    } catch {
      /* ignore */
    }
  }, [outboundE164, country?.id, onChange, persistLoginDefaults])

  const setFromRawInput = (raw, inputEl) => {
    const el = inputEl || inputRef.current
    const cursorBefore = el?.selectionStart ?? String(raw || '').length
    const digitsBeforeCursor = onlyDigits(String(raw || '').slice(0, cursorBefore)).length

    const s = String(raw || '')
    const d = onlyDigits(s)
    const found = s.trim().startsWith('+') ? pickCountryByDial(d) : null
    let nextCountry = country
    let nextNational = national
    if (found) {
      nextCountry = found
      nextNational = normalizeNationalDigits(found.id, d.slice(found.dial.length))
    } else {
      nextNational = normalizeNationalDigits(countryId, d)
    }

    setCountry(nextCountry)
    setNational(nextNational)

    const nextMasked = formatNationalDisplay(nextCountry?.id || countryId, nextNational)
    requestAnimationFrame(() => {
      if (!el) return
      const pos = caretAfterDigitIndex(nextMasked, digitsBeforeCursor)
      try {
        el.setSelectionRange(pos, pos)
      } catch {
        /* ignore */
      }
    })
  }

  const focusPhoneInput = () => {
    try {
      inputRef.current?.focus({ preventScroll: true })
    } catch {
      inputRef.current?.focus()
    }
  }

  return (
    <div ref={rootRef} className={['mx-phone-input-shell relative z-10', className].filter(Boolean).join(' ')}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[48px] rounded-xl bg-[#13112e] border border-indigo-500/20 hover:border-indigo-500/40 text-gray-200 text-sm touch-manipulation"
          aria-label="Ölkə kodu seç"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="font-mono text-xs tabular-nums">+{country.dial}</span>
          <span className="text-xs text-gray-500">▾</span>
        </button>

        <input
          ref={inputRef}
          id={inputId}
          name={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          required={required}
          className="mx-phone-input-native flex-1 min-w-0 bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-base font-mono tabular-nums tracking-wide outline-none focus:border-blue-500 min-h-[48px] touch-manipulation"
          style={{ fontSize: '16px' }}
          placeholder={placeholder || (countryId === 'AZ' ? '50 123 45 67' : 'Telefon')}
          value={masked}
          onChange={(e) => setFromRawInput(e.target.value, e.target)}
          onClick={focusPhoneInput}
          onTouchEnd={(e) => {
            e.stopPropagation()
            focusPhoneInput()
          }}
          maxLength={countryId === 'AZ' ? 13 : undefined}
        />
      </div>
      <div className="min-h-[1.35rem] mt-1.5">
        {azInvalid ? (
          <p className="text-xs text-red-400/95">
            Mobil nömrə 9 rəqəm olmalıdır (məs: 50 123 45 67). Operator: 50, 51, 55, 70, 77 və s.
          </p>
        ) : null}
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-indigo-500/20 bg-[#13112e] overflow-hidden">
          <div className="p-2 border-b border-indigo-500/15">
            <input
              className="w-full bg-[#0f0c29] border border-indigo-500/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
              placeholder="Ölkə axtar… (AZ, 994, Turkey)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCountry(c)
                  setNational((prev) => normalizeNationalDigits(c.id, prev))
                  setOpen(false)
                  setQuery('')
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white/5 ${
                  c && country && c.id === country.id ? 'bg-blue-500/10' : ''
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{c.flag}</span>
                  <span className="truncate text-gray-200">{c.name}</span>
                </span>
                <span className="font-mono text-xs text-gray-400 tabular-nums">+{c.dial}</span>
              </button>
            ))}
            {list.length === 0 && <div className="px-3 py-3 text-xs text-gray-500">Tapılmadı</div>}
          </div>
        </div>
      )}
    </div>
  )
}
