import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUiLocale, uiLocaleMeta, UI_LOCALES } from './uiLocales.js'

describe('normalizeUiLocale', () => {
  it('keeps az ru en tr de', () => {
    assert.equal(normalizeUiLocale('az'), 'az')
    assert.equal(normalizeUiLocale('ru'), 'ru')
    assert.equal(normalizeUiLocale('en'), 'en')
    assert.equal(normalizeUiLocale('tr'), 'tr')
    assert.equal(normalizeUiLocale('de'), 'de')
  })

  it('maps regional tags', () => {
    assert.equal(normalizeUiLocale('en-GB'), 'en')
    assert.equal(normalizeUiLocale('tr-TR'), 'tr')
    assert.equal(normalizeUiLocale('de-DE'), 'de')
  })

  it('falls back to az', () => {
    assert.equal(normalizeUiLocale('fr'), 'az')
    assert.equal(normalizeUiLocale(''), 'az')
  })
})

describe('uiLocaleMeta', () => {
  it('lists five languages like the picker', () => {
    assert.deepEqual(
      UI_LOCALES.map((x) => x.code),
      ['en', 'az', 'ru', 'tr', 'de'],
    )
    assert.equal(uiLocaleMeta('az').nativeName, 'Azərbaycan')
  })
})
