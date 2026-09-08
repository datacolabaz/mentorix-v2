const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pickEmailLoginRole } = require('./pickEmailLoginRole');

describe('pickEmailLoginRole', () => {
  it('logs a participant in even when the client asked for instructor first', () => {
    assert.equal(pickEmailLoginRole('instructor', ['student']), 'student');
    assert.equal(pickEmailLoginRole('', ['student']), 'student');
    assert.equal(pickEmailLoginRole(undefined, ['student']), 'student');
  });

  it('keeps an explicit matching role for dual-role accounts', () => {
    assert.equal(pickEmailLoginRole('student', ['instructor', 'course', 'student']), 'student');
    assert.equal(pickEmailLoginRole('instructor', ['instructor', 'course', 'student']), 'instructor');
  });

  it('defaults to the first eligible role when no hint is sent', () => {
    assert.equal(pickEmailLoginRole(null, ['instructor', 'course']), 'instructor');
    assert.equal(pickEmailLoginRole('parent', ['instructor']), 'instructor');
  });
});
