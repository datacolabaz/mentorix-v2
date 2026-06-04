import { useEffect, useState } from 'react'
import api from '../../lib/api'

function CategoryColumn({ nodes, onSelect, depth = 0 }) {
  if (!nodes?.length) return null
  return (
    <ul
      className={[
        'min-w-[200px] max-h-[320px] overflow-y-auto py-1',
        depth > 0 ? 'border-l border-white/10' : '',
      ].join(' ')}
    >
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-primary/15 flex items-center justify-between gap-2"
            onMouseEnter={() => onSelect?.hover?.(node)}
            onClick={() => {
              if (node.slug && !node.is_virtual_category) onSelect?.pick?.(node)
              else if (node.target_category_id) onSelect?.pick?.({ id: node.target_category_id, slug: null, name_az: node.name_az })
            }}
          >
            <span className="truncate">{node.name_az}</span>
            {node.is_popular ? <span className="text-[9px] text-amber-400 shrink-0">★</span> : null}
          </button>
          {node.subcategories?.length && onSelect?.activeId === node.id ? (
            <CategoryColumn nodes={node.subcategories} onSelect={onSelect} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export default function CategoryMegaMenu({ onPick }) {
  const [open, setOpen] = useState(false)
  const [tree, setTree] = useState([])
  const [popular, setPopular] = useState([])
  const [hoverRoot, setHoverRoot] = useState(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [treeRes, popRes] = await Promise.all([
          api.get('/public/categories'),
          api.get('/public/categories/popular'),
        ])
        if (cancelled) return
        if (treeRes?.success) setTree(Array.isArray(treeRes.categories) ? treeRes.categories : [])
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

  const handlePick = (node) => {
    onPick?.({
      category_id: node.id,
      category_slug: node.slug,
      category_name: node.name_az,
    })
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 items-center">
        {popular.slice(0, 8).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePick(p)}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:border-primary/40 hover:text-primary"
          >
            {p.name_az}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-primary/40 text-primary bg-primary/10"
        >
          Bütün fənlər ▾
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[600] bg-black/40"
            aria-label="Bağla"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 sm:right-auto z-[700] mt-2 flex rounded-xl border border-white/15 bg-[#12121f] shadow-2xl overflow-hidden max-w-[min(100vw-2rem,720px)]">
            <CategoryColumn
              nodes={tree}
              onSelect={{
                hover: (n) => setHoverRoot(n.id),
                activeId: hoverRoot || tree[0]?.id,
                pick: handlePick,
              }}
            />
            {hoverRoot ? (
              <CategoryColumn
                nodes={tree.find((t) => t.id === hoverRoot)?.subcategories || []}
                onSelect={{ pick: handlePick, activeId: null }}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
