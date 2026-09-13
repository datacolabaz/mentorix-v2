const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRecordingLimits,
  checkRecordingUploadQuota,
  computeExpiresAt,
  usageMeter,
  hoursToSeconds,
} = require('./liveRecordingQuotaMath');

describe('normalizeRecordingLimits', () => {
  it('maps plan hours to seconds and zeros basic', () => {
    assert.equal(hoursToSeconds(5), 18000);
    const basic = normalizeRecordingLimits({
      recording_hours_monthly: 0,
      recording_storage_bytes: 0,
      recording_retention_days: 0,
      recording_max_duration_sec: 0,
    });
    assert.equal(basic.hours_monthly, 0);
    assert.equal(basic.seconds_monthly, 0);

    const pro = normalizeRecordingLimits({
      recording_hours_monthly: 5,
      recording_storage_bytes: 5 * 1024 * 1024 * 1024,
      recording_retention_days: 30,
      recording_max_duration_sec: 7200,
      recording_max_quality: '720p',
    });
    assert.equal(pro.seconds_monthly, 18000);
    assert.equal(pro.max_quality, '720p');
  });
});

describe('checkRecordingUploadQuota', () => {
  const proLimits = {
    recording_hours_monthly: 5,
    recording_storage_bytes: 5 * 1024 * 1024 * 1024,
    recording_retention_days: 30,
    recording_max_duration_sec: 7200,
  };

  it('blocks basic / not included', () => {
    const r = checkRecordingUploadQuota({
      limits: { recording_hours_monthly: 0, recording_storage_bytes: 0, recording_max_duration_sec: 0 },
      usedSeconds: 0,
      usedStorageBytes: 0,
      incomingDurationSec: 60,
      incomingByteSize: 1000,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'RECORDING_NOT_INCLUDED');
  });

  it('blocks over max duration', () => {
    const r = checkRecordingUploadQuota({
      limits: proLimits,
      usedSeconds: 0,
      usedStorageBytes: 0,
      incomingDurationSec: 7201,
      incomingByteSize: 1000,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'RECORDING_MAX_DURATION');
  });

  it('blocks hours exceeded', () => {
    const r = checkRecordingUploadQuota({
      limits: proLimits,
      usedSeconds: 17900,
      usedStorageBytes: 0,
      incomingDurationSec: 200,
      incomingByteSize: 1000,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'RECORDING_HOURS_EXCEEDED');
  });

  it('blocks storage exceeded', () => {
    const r = checkRecordingUploadQuota({
      limits: proLimits,
      usedSeconds: 0,
      usedStorageBytes: 5 * 1024 * 1024 * 1024 - 100,
      incomingDurationSec: 60,
      incomingByteSize: 200,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'RECORDING_STORAGE_EXCEEDED');
  });

  it('allows when under limits and when replacing releases quota', () => {
    const ok = checkRecordingUploadQuota({
      limits: proLimits,
      usedSeconds: 1000,
      usedStorageBytes: 1000,
      incomingDurationSec: 600,
      incomingByteSize: 2000,
    });
    assert.equal(ok.ok, true);

    const replace = checkRecordingUploadQuota({
      limits: proLimits,
      usedSeconds: 18000,
      usedStorageBytes: 5 * 1024 * 1024 * 1024,
      incomingDurationSec: 100,
      incomingByteSize: 100,
      releasingSeconds: 200,
      releasingBytes: 500,
    });
    assert.equal(replace.ok, true);
  });
});

describe('computeExpiresAt / usageMeter', () => {
  it('computes retention expiry and meter percents', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const exp = computeExpiresAt(created, 30);
    assert.equal(exp.toISOString(), '2026-01-31T00:00:00.000Z');
    assert.equal(computeExpiresAt(created, 0), null);

    const meter = usageMeter({
      limits: {
        recording_hours_monthly: 5,
        recording_storage_bytes: 1000,
        recording_retention_days: 30,
        recording_max_duration_sec: 7200,
      },
      usedSeconds: 3600,
      usedStorageBytes: 800,
    });
    assert.equal(meter.recording_enabled, true);
    assert.equal(meter.hours_used, 1);
    assert.equal(meter.hours_pct, 20);
    assert.equal(meter.storage_pct, 80);
    assert.equal(meter.near_limit, true);
  });
});
