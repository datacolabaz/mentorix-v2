import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PublicMarketingNav from '../../components/public/PublicMarketingNav'
import PublicSeoFooter from '../../components/public/PublicSeoFooter'
import api from '../../lib/api'

export default function Favorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .get('/favorites')
      .then((res) => {
        if (!cancelled) setFavorites(res?.favorites || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Favoritlər yüklənmədi')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const remove = async (id) => {
    await api.delete(`/favorites/${encodeURIComponent(id)}`)
    setFavorites((items) => items.filter((item) => String(item.id) !== String(id)))
  }

  return (
    <div className="min-h-[100svh] bg-[#f4f6fb] text-slate-800 flex flex-col">
      <PublicMarketingNav />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        <Link to="/search" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">← Axtarışa qayıt</Link>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Hesabım</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Favorit mentorlarım</h1>
            <p className="mt-2 text-slate-600">Bəyəndiyiniz mentorları burada saxlayın və uyğun olanla əlaqə saxlayın.</p>
          </div>
          <Link to="/mentorship" className="hidden sm:inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Mentor axtar</Link>
        </div>
        {loading ? <p className="mt-10 text-sm text-slate-500">Yüklənir…</p> : null}
        {error ? <p className="mt-10 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
        {!loading && !error && favorites.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-semibold text-slate-800">Hələ favorit mentorunuz yoxdur.</p>
            <Link to="/search" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400">Mentorları kəşf et</Link>
          </div>
        ) : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((mentor) => (
            <article key={mentor.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">{mentor.full_name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{mentor.subject || 'Mentor'}</p>
                </div>
                <button type="button" onClick={() => remove(mentor.id)} className="text-xl leading-none text-rose-500 hover:text-rose-700" aria-label="Favoritdən çıxar">♥</button>
              </div>
              <Link to={`/teachers/${mentor.id}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-100">Profilə bax</Link>
            </article>
          ))}
        </div>
      </main>
      <PublicSeoFooter />
    </div>
  )
}
