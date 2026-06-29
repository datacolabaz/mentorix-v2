import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

function GoldStar({ className = '' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={`w-3.5 h-3.5 shrink-0 ${className}`}
    >
      <path
        fill="currentColor"
        d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z"
      />
    </svg>
  )
}

function sortByPopular(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) return []
  return [...nodes]
    .sort((a, b) => {
      if (Boolean(a.is_popular) !== Boolean(b.is_popular)) return a.is_popular ? -1 : 1
      return String(a.name_az || '').localeCompare(String(b.name_az || ''), 'az')
    })
    .map((n) => ({
      ...n,
      subcategories: sortByPopular(n.subcategories),
    }))
}

function CategoryList({ nodes, activeId, onHover, onPick, emptyLabel }) {
  const sorted = useMemo(() => sortByPopular(nodes), [nodes])
  if (!sorted.length) {
    return <p className="px-3 py-4 text-xs text-gray-500">{emptyLabel || '—'}</p>
  }
  return (
    <ul className="min-w-[200px] max-h-[340px] overflow-y-auto py-1">
      {sorted.map((node) => {
        const hasChildren = Array.isArray(node.subcategories) && node.subcategories.length > 0
        const isActive = activeId === node.id
        return (
          <li key={node.id}>
            <button
              type="button"
              className={[
                'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
                isActive ? 'bg-primary/20 text-primary' : 'text-gray-200 hover:bg-white/5',
              ].join(' ')}
              onMouseEnter={() => onHover?.(node)}
              onFocus={() => onHover?.(node)}
              onClick={() => {
                if (hasChildren && !node.slug && !node.target_category_id) {
                  onHover?.(node)
                  return
                }
                if (node.slug && !node.is_virtual_category) onPick?.(node)
                else if (node.target_category_id) {
                  onPick?.({
                    id: node.target_category_id,
                    slug: null,
                    name_az: node.name_az,
                  })
                } else if (hasChildren) onHover?.(node)
              }}
            >
              <span className="truncate">{node.name_az}</span>
              {node.is_popular ? <GoldStar className="text-amber-400" /> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default function CategoryMegaMenu({ onPick, activeCategoryId }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [tree, setTree] = useState([])
  const [popular, setPopular] = useState([])
  const [hoverRoot, setHoverRoot] = useState(null)
  const [hoverChild, setHoverChild] = useState(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [treeRes, popRes] = await Promise.all([
          api.get('/public/categories'),
          api.get('/public/categories/popular'),
        ])
        if (cancelled) return
        if (treeRes?.success) {
          const roots = sortByPopular(Array.isArray(treeRes.categories) ? treeRes.categories : [])
          setTree(roots)
          if (roots[0]) {
            setHoverRoot(roots[0].id)
            const firstChild = roots[0].subcategories?.[0]
            setHoverChild(firstChild?.id || null)
          }
        }
        if (popRes?.success) setPopular(Array.isArray(popRes.popular) ? popRes.popular : [])
      } catch {
        if (!cancelled) {
          setTree([])
          setPopular([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const rootNode = tree.find((node) => node.id === hoverRoot)
  const childNode = rootNode?.subcategories?.find((c) => c.id === hoverChild)
  const grandChildren = childNode?.subcategories || []

  const handlePick = (node) => {
    onPick?.({
      category_id: node.id,
      category_slug: node.slug || null,
      category_name: node.name_az,
    })
    setOpen(false)
  }

  const handlePopularPick = (p) => {
    handlePick({
      id: p.id,
      slug: p.slug,
      name_az: p.name_az,
    })
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 items-center">
        {popular.slice(0, 8).map((p) => {
          const active = activeCategoryId === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePopularPick(p)}
              className={[
                'text-[11px] font-semibold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 transition-colors',
                active
                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                  : 'border-white/10 bg-white/5 text-gray-300 hover:border-primary/40 hover:text-primary',
              ].join(' ')}
            >
              {p.is_popular ? <GoldStar className="text-amber-400 w-3 h-3" /> : null}
              {p.name_az}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-primary/40 text-primary bg-primary/10"
        >
          {t('marketplace.categories.allSubjects')}
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[600] bg-black/50 backdrop-blur-[1px]"
            aria-label={t('marketplace.categories.close')}
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 sm:right-auto z-[700] mt-2 flex rounded-xl border border-white/15 bg-[#12121f] shadow-2xl overflow-hidden max-w-[min(100vw-1rem,860px)]">
            <div className="border-r border-white/10 bg-[#0f0f18]">
              <p className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {t('marketplace.categories.category')}
              </p>
              <CategoryList
                nodes={tree}
                activeId={hoverRoot}
                onHover={(n) => {
                  setHoverRoot(n.id)
                  const first = sortByPopular(n.subcategories)[0]
                  setHoverChild(first?.id || null)
                }}
                onPick={handlePick}
              />
            </div>
            <div className="border-r border-white/10 min-w-[200px]">
              <p className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">
                {rootNode?.name_az || t('marketplace.categories.subgroup')}
              </p>
              <CategoryList
                nodes={rootNode?.subcategories || []}
                activeId={hoverChild}
                onHover={(n) => setHoverChild(n.id)}
                onPick={handlePick}
                emptyLabel={t('marketplace.categories.noSubcategories')}
              />
            </div>
            {grandChildren.length > 0 ? (
              <div className="min-w-[200px]">
                <p className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">
               