import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

/**
 * The viewport is the only page scroller. If html/body/#root turn into scroll containers
 * (a fixed height plus overflow-x: hidden computes overflow-y to auto), #root scrolls the page
 * instead of the window: a second scrollbar and blank space appear below the footer, sticky
 * headers drift, and window.scrollTo / body scroll locks stop working.
 */

const CSS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.css')
const SCROLLING = new Set(['hidden', 'auto', 'scroll', 'overlay'])

function declarationsFor(selector) {
  const root = postcss.parse(fs.readFileSync(CSS_FILE, 'utf8'))
  const decls = {}
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.name !== 'layer') return
    if (!rule.selectors.map((s) => s.trim()).includes(selector)) return
    rule.walkDecls((d) => {
      decls[d.prop] = d.value.trim()
    })
  })
  return decls
}

const overflowValues = (decls) =>
  ['overflow', 'overflow-x', 'overflow-y'].flatMap((p) => (decls[p] ? decls[p].split(/\s+/) : []))

describe('document scroll model (index.css)', () => {
  it('keeps html overflow visible so body overflow propagates to the viewport', () => {
    expect(overflowValues(declarationsFor('html'))).toEqual([])
  })

  it('does not give body a fixed height (it would become a nested scroller)', () => {
    expect(declarationsFor('body').height).toBeUndefined()
  })

  it('never makes #root a scroll container', () => {
    const decls = declarationsFor('#root')
    expect(decls.height).toBeUndefined()
    expect(overflowValues(decls).filter((v) => SCROLLING.has(v))).toEqual([])
  })
})
