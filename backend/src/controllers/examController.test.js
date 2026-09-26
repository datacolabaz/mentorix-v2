const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Mock db
let executedQueries = [];
const mockClient = {
  query: async (sql, params) => {
    executedQueries.push({ sql, params });
    if (sql.includes('SELECT 1 FROM exams WHERE slug =')) {
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO exams')) {
      return {
        rows: [
          {
            id: 'exam-uuid-1',
            instructor_id: params[0],
            title: params[1],
            is_verified: false,
            slug: params[23],
          },
        ],
      };
    }
    return { rows: [] };
  },
};

const mockDb = {
  transaction: async (cb) => cb(mockClient),
  query: mockClient.query,
};

require.cache[require.resolve('../utils/db')] = {
  id: require.resolve('../utils/db'),
  filename: require.resolve('../utils/db'),
  loaded: true,
  exports: mockDb,
};

// Mock dependencies that require external packages not present in unit test env
require.cache[require.resolve('../services/studentNotificationEmailService')] = {
  id: require.resolve('../services/studentNotificationEmailService'),
  filename: require.resolve('../services/studentNotificationEmailService'),
  loaded: true,
  exports: { sendStudentEmailNotification: async () => {} },
};

require.cache[require.resolve('../services/emailService')] = {
  id: require.resolve('../services/emailService'),
  filename: require.resolve('../services/emailService'),
  loaded: true,
  exports: { sendEmail: async () => {} },
};

require.cache[require.resolve('../services/certificatePdfService')] = {
  id: require.resolve('../services/certificatePdfService'),
  filename: require.resolve('../services/certificatePdfService'),
  loaded: true,
  exports: {},
};

require.cache[require.resolve('../services/certificateService')] = {
  id: require.resolve('../services/certificateService'),
  filename: require.resolve('../services/certificateService'),
  loaded: true,
  exports: {
    instructorHasCertificateFeature: async () => false,
    maybeIssueCertificateAfterExamSubmit: async () => null,
    evaluateCertificateEligibility: async () => null,
    slimCertificateRow: (x) => x,
  },
};

require.cache[require.resolve('../services/participantGroupService')] = {
  id: require.resolve('../services/participantGroupService'),
  filename: require.resolve('../services/participantGroupService'),
  loaded: true,
  exports: {
    ensureExamParticipantGroup: async () => {},
    addStudentToExamParticipantGroup: async () => {},
  },
};

const { createExam } = require('./examController');

describe('examController.createExam', () => {
  it('maps $24 (examSlug) to slug column and FALSE to is_verified column with matching column count', async () => {
    executedQueries = [];
    const req = {
      user: { id: 'inst-1', role: 'instructor' },
      body: {
        title: 'Sınaq İmtahanı 1',
        subject: 'Riyaziyyat',
        duration_minutes: 60,
        start_time: '2026-05-01T10:00:00.000Z',
      },
    };
    let jsonResult = null;
    const res = {
      status: (code) => {
        res.statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResult = data;
        return res;
      },
    };

    await createExam(req, res);

    assert.equal(jsonResult.success, true);
    const insertQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO exams'));
    assert.ok(insertQuery, 'INSERT INTO exams query was executed');

    // Parse columns and values from SQL query
    const match = insertQuery.sql.match(/INSERT INTO exams \(([^)]+)\)\s+VALUES \(([^)]+)\)/i);
    assert.ok(match, 'SQL query matches expected INSERT INTO ... VALUES ... pattern');

    const columns = match[1].split(',').map((c) => c.trim());
    const values = match[2].split(',').map((v) => v.trim());

    // 1. Verify column count equals values count
    assert.equal(columns.length, values.length, `Column count (${columns.length}) must equal VALUES count (${values.length})`);
    assert.equal(columns.length, 26, 'Should have exactly 26 columns');

    // 2. Verify is_verified column maps to FALSE
    const isVerifiedIdx = columns.indexOf('is_verified');
    assert.notEqual(isVerifiedIdx, -1, 'is_verified column exists');
    assert.equal(values[isVerifiedIdx], 'FALSE', 'is_verified value must be FALSE');

    // 3. Verify slug column maps to $24
    const slugIdx = columns.indexOf('slug');
    assert.notEqual(slugIdx, -1, 'slug column exists');
    assert.equal(values[slugIdx], '$24', 'slug value must be $24');

    // 4. Verify parameter 24 ($24, array index 23) is the generated exam slug string
    const params = insertQuery.params;
    assert.equal(params.length, 24, 'Parameter array must contain exactly 24 elements');
    const examSlug = params[23];
    assert.match(examSlug, /^sinaq-imtahani-1/);
  });
});
