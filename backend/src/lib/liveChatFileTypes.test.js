const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedLiveChatFilename, shouldInlineLiveChatFile } = require('./liveChatFileTypes');

describe('isAllowedLiveChatFilename', () => {
  it('allows the requested document and code types', () => {
    for (const name of ['a.xlsx', 'n.pdf', 'p.png', 'j.jpg', 'j.jpeg', 'n.txt', 'i.html', 'd.csv', 'm.py', 'a.js', 'M.java']) {
      assert.equal(isAllowedLiveChatFilename(name), true, name);
    }
  });

  it('blocks executables and svg', () => {
    assert.equal(isAllowedLiveChatFilename('setup.exe'), false);
    assert.equal(isAllowedLiveChatFilename('icon.svg'), false);
  });
});

describe('shouldInlineLiveChatFile', () => {
  it('inlines images and pdf, downloads html/js', () => {
    assert.equal(shouldInlineLiveChatFile('a.png'), true);
    assert.equal(shouldInlineLiveChatFile('a.pdf'), true);
    assert.equal(shouldInlineLiveChatFile('a.html'), false);
    assert.equal(shouldInlineLiveChatFile('a.js'), false);
  });
});
