import { useEffect, useMemo, useRef, useState } from 'react'
import { canonicalAzPhoneE164, isValidAzMobileNational, onlyDigits as azOnlyDigits } from '../../lib/azPhone'

const STORAGE_COUNTRY = 'mx_login_country'
const STORAGE_PHONE = 'mx_login_phone'

const COUNTRIES = [
  // AZ mobil: 9 rəqəm (50/51/70/77 və s.) — maskada ilk rəqəmi “məcburi 5” kimi göstərməyək
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
    // accept: 0XXXXXXXXX, 994XXXXXXXXX, +994XXXXXXXXX, or raw 9 digits
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
    // 2 + 3 + 2 + 2 = 9
    const a = n.slice(0, 2)
    const b = n.slice(2, 5)
    const c = n.slice(5, 7)
    const d = n.slice(7, 9)
    return [a, b, c, d].filter(Boolean).join(' ')
  }
  // digər ölkələr üçün sadə qrup (3-3-4 və ya ümumi)
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

export default function PhoneInput({
  value,
  onChange,
  className,
  placeholder,
  autoFocus,
  required,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  const initialCountry = useMemo(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_COUNTRY) : null
    const c = saved ? COUNTRIES.find((x) => x && x.id === saved) : null
    return c || COUNTRIES[0]
  }, [])

  const [country, setCountry] = useState(initialCountry)
  const [national, setNational] = useState('')
  const prevPropValue = useRef(undefined)
  const didHydrateFromStorage = useRef(false)

  // İlk yükləmə: parent boşdursa, saxlanmış nömrəni bir dəfə göstər
  useEffect(() => {
    if (didHydrateFromStorage.current) return
    const incoming = String(value || '').trim()
    if (incoming) {
      didHydrateFromStorage.current = true
      return
    }
    const savedPhone = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PHONE) : null
    if (savedPhone) {
      const d = onlyDigits(savedPhone)
      const found = pickCountryByDial(d)
      if (found) {
        setCountry(found)
        setNational(normalizeNationalDigits(found.id, d.slice(found.dial.length)))
      }
    }
    didHydrateFromStorage.current = true
  }, [value])

  // Parent-dan gələn value dəyişəndə sinxronla (typing echo loop olmasın)
  useEffect(() => {
    const incoming = String(value || '').trim()
    if (prevPropValue.current === incoming) return
    const prev = prevPropValue.current
    prevPropValue.current = incoming

    if (incoming) {
      const d = onlyDigits(incoming)
      const found = pickCountryByDial(d)
      if (found) {
        setCountry(found)
        setNational(normalizeNationalDigits(found.id, d.slice(found.dial.length)))
      }
      return
    }
    // İlk mount: parent boş ola bilər; localStorage yükləməsini sıfırlamayaq
    if (prev === undefined) return
    setNational('')
  }, [value])

  // Close dropdown on outside click / Esc
  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

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
  const full = useMemo(() => e164(country || COUNTRIES[0], national), [country, national])

  const outboundE164 = useMemo(() => {
    if (countryId === 'AZ') {
      return canonicalAzPhoneE164(full) || ''
    }
    return full
  }, [countryId, full])

  const azInvalid =
    countryId === 'AZ' &&
    onlyDigits(national).length > 0 &&
    (onlyDigits(national).length !== 9 || !isValidAzMobileNational(national))

  // Propagate + persist (AZ: yalnız tam və düzgün 9 rəqəm)
  useEffect(() => {
    if (typeof onChange === 'function') onChange(outboundE164)
    try {
      localStorage.setItem(STORAGE_COUNTRY, country?.id || 'AZ')
      if (outboundE164) localStorage.setItem(STORAGE_PHONE, outboundE164)
      else localStorage.removeItem(STORAGE_PHONE)
    } catch {
      // ignore
    }
  }, [outboundE164, country?.id])

  const setFromRawInput = (raw) => {
    const s = String(raw || '')
    // If user pasted a full +<code> number, try to detect country
    const d = onlyDigits(s)
    const found = s.trim().startsWith('+') ? pickCountryByDial(d) : null
    if (found) {
      setCountry(found)
      setNational(normalizeNationalDigits(found.id, d.slice(found.dial.length)))
      return
    }
    setNational(normalizeNationalDigits(countryId, d))
  }

  return (
    <div ref={rootRef} className={className}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 flex items-center gap-2 px-3 rounded-xl bg-[#13112e] border border-indigo-500/20 hover:border-indigo-500/40 text-gray-200 text-sm"
          aria-label="Ölkə kodu seç"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="font-mono text-xs">+{country.dial}</span>
          <span className="text-xs text-gray-500">▾</span>
        </button>

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus={autoFocus}
          required={required}
          className="flex-1 min-w-0 bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
          placeholder={placeholder || (countryId === 'AZ' ? '50 123 45 67' : 'Telefon')}
          value={masked}
          onChange={(e) => setFromRawInput(e.target.value)}
          maxLength={countryId === 'AZ' ? 12 : undefined}
        />
      </div>
      {azInvalid ? (
        <p className="mt-1.5 text-xs text-red-400/95">
          Mobil nömrə 9 rəqəm olmalıdır (məs: 50 123 45 67). Operator: 50, 51, 55, 70, 77 və s.
        </p>
      ) : countryId === 'AZ' && onlyDigits(national).length === 9 && outboundE164 ? (
        <p className="mt-1.5 text-xs text-emerald-400/90 font-mono">{outboundE164}</p>
      ) : null}

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
                <span className="font-mono text-xs text-gray-400">+{c.dial}</span>
              </button>
            ))}
            {list.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-500">Tapılmadı</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

