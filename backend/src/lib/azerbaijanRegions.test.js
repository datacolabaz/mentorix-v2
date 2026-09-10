const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyInstructorRegionDistrictFields,
  resolveBakuDistrictUpdate,
} = require('./azerbaijanRegions');

describe('resolveBakuDistrictUpdate', () => {
  it('clears district once when region is empty and district is also sent', () => {
    const result = resolveBakuDistrictUpdate({
      regionSpecified: true,
      region: null,
      districtSpecified: true,
      district: null,
    });
    assert.deepEqual(result, { value: null });
  });

  it('clears district when region is not Bakı', () => {
    const result = resolveBakuDistrictUpdate({
      regionSpecified: true,
      region: 'Gəncə',
      districtSpecified: true,
      district: 'Yasamal',
    });
    assert.deepEqual(result, { value: null });
  });

  it('keeps Bakı district when region is Bakı', () => {
    const result = resolveBakuDistrictUpdate({
      regionSpecified: true,
      region: 'Bakı',
      districtSpecified: true,
      district: 'Yasamal',
    });
    assert.deepEqual(result, { value: 'Yasamal' });
  });

  it('skips when only region=Bakı is sent without district', () => {
    const result = resolveBakuDistrictUpdate({
      regionSpecified: true,
      region: 'Bakı',
      districtSpecified: false,
      district: undefined,
    });
    assert.deepEqual(result, { skip: true });
  });
});

describe('applyInstructorRegionDistrictFields', () => {
  it('does not assign baku_district twice when settings send region + null district', () => {
    const sets = [];
    const vals = [];
    const { nextIndex, error } = applyInstructorRegionDistrictFields(sets, vals, 1, {
      region: null,
      baku_district: null,
    });
    assert.equal(error, null);
    const districtSets = sets.filter((s) => s.startsWith('baku_district'));
    assert.equal(districtSets.length, 1);
    assert.equal(sets.includes('region = $1'), true);
    assert.equal(vals.filter((v) => v === null).length, 2); // region + district
    assert.equal(nextIndex, 4);
  });

  it('sets Bakı district once with region and district together', () => {
    const sets = [];
    const vals = [];
    const { error } = applyInstructorRegionDistrictFields(sets, vals, 1, {
      region: 'Bakı',
      baku_district: 'Yasamal',
    });
    assert.equal(error, null);
    assert.equal(sets.filter((s) => s.startsWith('baku_district')).length, 1);
    assert.equal(vals.includes('Yasamal'), true);
  });
});
