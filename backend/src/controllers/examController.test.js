const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('createExam query parameter alignment in examController.js', () => {
  const controllerPath = path.join(__dirname, 'examController.js');
  const content = fs.readFileSync(controllerPath, 'utf8');

  // Verify the INSERT INTO exams query structure
  const insertRegex = /INSERT INTO exams \(([^)]+)\)\s+VALUES \(([^)]+)\)/s;
  const match = content.match(insertRegex);

  assert.ok(match, 'INSERT INTO exams statement should be present in examController.js');

  const columns = match[1].split(',').map((c) => c.trim().replace(/\s+/g, ' '));
  const values = match[2].split(',').map((v) => v.trim().replace(/\s+/g, ' '));

  assert.equal(columns.length, 26, 'Should have exactly 26 columns in INSERT INTO exams');
  assert.equal(values.length, 26, 'Columns and values count in INSERT INTO exams must match (26 elements)');

  const expectedMapping = {
    instructor_id: '$1',
    title: '$2',
    subject: '$3',
    topic: '$4',
    pdf_url: '$5',
    exam_files: '$6::jsonb',
    duration_minutes: '$7',
    start_time: '$8',
    available_from: '$9',
    available_until: '$10',
    allow_finish_after_until: '$11',
    notify_enabled: '$12',
    notify_students: '$13',
    notify_before_hours: '$14',
    show_results: '$15',
    wrong_penalty_enabled: '$16',
    certificate_enabled: '$17',
    certificate_pass_pct: '$18',
    certificate_template_id: '$19',
    category_id: '$20',
    level: '$21',
    certificate_type: '$22',
    is_public: '$23',
    is_verified: 'FALSE',
    slug: '$24',
    status: "'scheduled'",
  };

  columns.forEach((col, idx) => {
    assert.equal(values[idx], expectedMapping[col], `Column ${col} at index ${idx} should map to ${expectedMapping[col]}`);
  });
});
