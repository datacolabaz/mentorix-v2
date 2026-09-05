import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedLiveChatAttachmentUrl, isAllowedLiveChatFilename, sanitizeLiveChatFile } from './liveChatFile.js'

describe('live chat file allowlist', () => {
  it('accepts only live chat attachment paths', () => {
    assert.equal(isAllowedLiveChatAttachmentUrl('/api/live/chat-attachments/a-1.pdf'), true)
    assert.equal(isAllowedLiveChatAttachmentUrl('https://evil.example/a.pdf'), false)
    assert.equal(isAllowedLiveChatAttachmentUrl('/api/live/chat-attachments/../x'), false)
  })

  it('allows xlsx pdf images text and code, blocks exe', () => {
    assert.equal(isAllowedLiveChatFilename('notes.xlsx'), true)
    assert.equal(isAllowedLiveChatFilename('app.py'), true)
    assert.equal(isAllowedLiveChatFilename('virus.exe'), false)
  })

  it('drops unsafe file metadata from the data channel', () => {
    assert.equal(sanitizeLiveChatFile({ url: 'https://evil.example/x' }), null)
    assert.equal(sanitizeLiveChatFile({ url: '/api/live/chat-attachments/ok.png', name: 'shot.png', type: 'image/png', size: 12 })?.name, 'shot.png')
  })
})
