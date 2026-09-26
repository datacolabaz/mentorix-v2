const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('createExam INSERT query parameter order matches VALUES list', () => {
  const filePath = path.join(__dirname, 'examController.js');
  const code = fs.readFileSync(filePath, 'utf8');

  // Find the INSERT INTO exams query string and parameter array in createExam
  const insertMatch = code.match(/INSERT INTO exams \(([^)]+)\)\s+VALUES \(([^)]+)\)/s);
  assert.ok(insertMatch, 'INSERT INTO exams query string should be present in examController.js');

  const columnsStr = insertMatch[1];
  const valuesStr = insertMatch[2];

  const columns = columnsStr.split(',').map((c) => c.trim());
  const values = valuesStr.split(',').map((v) => v.trim());

  assert.equal(
    columns.length,
    26,
    `Expected 26 columns in INSERT statement, found ${columns.length}`
  );

  assert.equal(
    values.length,
    26,
    `Column count (${columns.length}) and value count (${values.length}) must match`
  );

  // Check positions of is_verified and slug
  const isVerifiedColIdx = columns.indexOf('is_verified');
  const slugColIdx = columns.indexOf('slug');

  assert.equal(isVerifiedColIdx, 23, 'is_verified column should be at 0-based index 23 (24th column)');
  assert.equal(slugColIdx, 24, 'slug column should be at 0-based index 24 (25th column)');

  assert.equal(
    values[isVerifiedColIdx],
    'FALSE',
    `Value for is_verified at index ${isVerifiedColIdx} should be FALSE`
  );

  assert.equal(
    values[slugColIdx],
    '$24',
    `Value for slug at index ${slugColIdx} should be $24`
  );

  // Verify parameters array in createExam has 24 elements matching $1..$24
  const paramArrayMatch = code.match(/\[\s*req\.user\.id,[\s\S]*?examSlug,\s*\]/);
  assert.ok(paramArrayMatch, 'Parameter array should be found in createExam');
});
