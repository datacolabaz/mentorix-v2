import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  DISCOVER_MAP_SUBJECT_INPUT_ID,
  DISCOVER_PROFILE_SECTION_ID,
  DISCOVER_SUBJECT_INPUT_ID,
  findScrollParent,
  resolveScrollTarget,
  scrollElementIntoAppView,
} from './scrollIntoAppView.js'

function el(tag, extras = {}) {
  const node = {
    tagName: String(tag).toUpperCase(),
    id: extras.id || '',
    parentElement: null,
    style: extras.style || {},
    scrollHeight: extras.scrollHeight ?? 0,
    clientHeight: extras.clientHeight ?? 0,
    scrollTop: 0,
    getBoundingClientRect: extras.getBoundingClientRect || (() => ({ top: 0, left: 0 })),
    focus: extras.focus || (() => {}),
    scrollTo(opts) {
      this.scrollTop = opts.top
    },
  }
  return node
}

describe('scrollIntoAppView', () => {
  const ids = new Map()
  const previous = {}

  beforeEach(() => {
    ids.clear()
    previous.window = global.window
    previous.document = global.document
    global.window = {
      getComputedStyle: (node) => ({ overflowY: node.style.overflowY || 'visible' }),
      scrollY: 0,
      scrollTo() {},
    }
    global.document = {
      body: el('body'),
      documentElement: el('html'),
      scrollingElement: null,
      getElementById: (id) => ids.get(id) || null,
    }
  })

  afterEach(() => {
    global.window = previous.window
    global.document = previous.document
  })

  it('finds the overflowing panel, not the window', () => {
    const panel = el('div', { style: { overflowY: 'auto' }, scrollHeight: 2000, clientHeight: 400 })
    const input = el('input')
    input.parentElement = panel
    panel.parentElement = document.body
    assert.equal(findScrollParent(input), panel)
  })

  it('prefers the subject input over the discover card', () => {
    ids.set(DISCOVER_PROFILE_SECTION_ID, el('div', { id: DISCOVER_PROFILE_SECTION_ID }))
    const input = el('input', { id: DISCOVER_SUBJECT_INPUT_ID })
    ids.set(DISCOVER_SUBJECT_INPUT_ID, input)
    assert.equal(resolveScrollTarget(DISCOVER_SUBJECT_INPUT_ID), input)
    assert.equal(resolveScrollTarget(DISCOVER_PROFILE_SECTION_ID)?.id, DISCOVER_PROFILE_SECTION_ID)
  })

  it('falls back to the map subject field while the discover card is still loading', () => {
    const mapInput = el('input', { id: DISCOVER_MAP_SUBJECT_INPUT_ID })
    ids.set(DISCOVER_MAP_SUBJECT_INPUT_ID, mapInput)
    assert.equal(resolveScrollTarget(DISCOVER_SUBJECT_INPUT_ID), mapInput)
  })

  it('scrolls the panel to the field and focuses it', () => {
    let focused = false
    const panel = el('div', {
      style: { overflowY: 'auto' },
      scrollHeight: 2000,
      clientHeight: 400,
      getBoundingClientRect: () => ({ top: 80 }),
    })
    const input = el('input', {
      id: DISCOVER_SUBJECT_INPUT_ID,
      getBoundingClientRect: () => ({ top: 900 }),
      focus: () => {
        focused = true
      },
    })
    input.parentElement = panel
    panel.parentElement = document.body
    assert.equal(scrollElementIntoAppView(input, { behavior: 'auto', offset: 16, focus: true }), true)
    assert.equal(panel.scrollTop, 900 - 80 - 16)
    assert.equal(focused, true)
  })

  it('focuses the nested subject input when the target is the section', () => {
    let focused = false
    const panel = el('div', {
      style: { overflowY: 'auto' },
      scrollHeight: 2000,
      clientHeight: 400,
      getBoundingClientRect: () => ({ top: 80 }),
    })
    const input = el('input', {
      focus: () => {
        focused = true
      },
    })
    const section = el('section', {
      id: DISCOVER_SUBJECT_INPUT_ID,
      getBoundingClientRect: () => ({ top: 700 }),
    })
    section.querySelector = () => input
    section.parentElement = panel
    panel.parentElement = document.body
    assert.equal(scrollElementIntoAppView(section, { behavior: 'auto', offset: 16, focus: true }), true)
    assert.equal(focused, true)
  })
})
