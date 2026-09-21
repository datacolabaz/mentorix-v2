const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeInvitationCode,
  buildInvitationLink,
} = require('./joinInvitationService');

describe('joinInvitationService', () => {
  describe('normalizeInvitationCode', () => {
    it('normalizes spaces and converts to uppercase', () => {
      assert.equal(normalizeInvitationCode('  abc-123 '), 'ABC-123');
      assert.equal(normalizeInvitationCode('a b c'), 'ABC');
      assert.equal(normalizeInvitationCode(null), '');
    });
  });

  describe('buildInvitationLink', () => {
    it('constructs frontend invitation URL correctly', () => {
      const link = buildInvitationLink('  grp123 ');
      assert.ok(link.includes('/join/GRP123'));
    });

    it('returns null for empty or null invitation code', () => {
      assert.equal(buildInvitationLink(null), null);
      assert.equal(buildInvitationLink(''), null);
    });
  });
});
