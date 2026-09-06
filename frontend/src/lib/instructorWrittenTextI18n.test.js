import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { localizeInstructorWrittenText } from './instructorWrittenTextI18n.js'

describe('localizeInstructorWrittenText', () => {
  it('keeps AZ unchanged', () => {
    assert.equal(localizeInstructorWrittenText('ADPU-Biologiya', 'az'), 'ADPU-Biologiya')
  })

  it('translates education subjects for EN and RU', () => {
    assert.equal(localizeInstructorWrittenText('ADPU-Biologiya', 'en'), 'ADPU-Biology')
    assert.equal(localizeInstructorWrittenText('ADPU-Biologiya', 'ru'), 'ADPU-Биология')
    assert.equal(localizeInstructorWrittenText('BDU – Kompüter Elmləri', 'en'), 'BDU – Computer Science')
    assert.equal(localizeInstructorWrittenText('BDU – Kompüter Elmləri', 'ru'), 'BDU – Компьютерные науки')
  })

  it('translates common teacher bio phrases for EN and RU', () => {
    const az =
      '5 ildən artıq SQL, Excel, Python və Tableau-dan müxtəlif kurslarda təlimlər verirəm. Tələbələrimdən bir çoxu ölkəmizdə və qlobal şirkətlərdə remote işləyirlər'
    const en = localizeInstructorWrittenText(az, 'en')
    const ru = localizeInstructorWrittenText(az, 'ru')
    assert.match(en, /More than 5 years/)
    assert.match(en, /I teach various courses/)
    assert.match(en, /Many of my students/)
    assert.match(en, /work remotely/)
    assert.doesNotMatch(en, /ildən|təlimlər|Tələbələrimdən/)
    assert.match(ru, /Более 5 лет/)
    assert.match(ru, /преподаю на различных курсах/)
    assert.match(ru, /Многие мои ученики/)
    assert.match(ru, /работают удалённо/)
  })

  it('translates informal about text without diacritics', () => {
    const az = 'Suallara mentiqi yanasma qisa anlasiqli izah meseleler ucun qisaldilmis yollar ve.s'
    const en = localizeInstructorWrittenText(az, 'en')
    const ru = localizeInstructorWrittenText(az, 'ru')
    assert.match(en, /logical approach/i)
    assert.match(en, /short, clear explanations/i)
    assert.match(en, /etc\./)
    assert.match(ru, /логический подход/i)
    assert.match(ru, /и т\.д\./)
  })

  it('leaves already-English certificates alone', () => {
    const cert = 'PROFESSIONAL CERTIFICATE IN DATA ANALYTICS'
    assert.equal(localizeInstructorWrittenText(cert, 'en'), cert)
    assert.equal(localizeInstructorWrittenText(cert, 'ru'), cert)
  })
})
