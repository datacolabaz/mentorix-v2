import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { intlCollatorLang, intlLocale, moneyLocale } from './uiLocale.js'

describe('uiLocale', () => {
  it('maps English to en-GB', () => {
    assert.equal(intlLocale('en'), 'en-GB')
    assert.equal(intlCollatorLang('en-US'), 'en')
    assert.equal(moneyLocale('en'), 'en-GB')
  })

  it('keeps az and ru', () => {
    assert.equal(intlLocale('az'), 'az-AZ')
    assert.equal(intlLocale('ru'), 'ru-RU')
  })
})
