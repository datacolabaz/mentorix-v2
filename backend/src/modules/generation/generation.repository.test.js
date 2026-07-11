const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createGenerationRequest,
  updateGenerationRequestStatus,
  createDraft,
  getDraftById,
  updateDraft,
  listDraftsByTeacher,
  updateDraftStatus,
} = require('./generation.repository');

/**
 * @param {unknown[][]} rowSets
 */
function createMockClient(rowSets = []) {
  const calls = [];
  let index = 0;
  const client = {
    calls,
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      return { rows: rowSets[index++] ?? [] };
    },
  };
  return client;
}

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const DRAFT_ID = '33333333-3333-4333-8333-333333333333';

const SAMPLE_INPUT = {
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  topic: 'Data Analytics',
  level: 'intermediate',
  questionCount: 3,
  format: 'mcq',
  difficulty: 'medium',
};

describe('generation.repository', () => {
  it('createGenerationRequest inserts into generation_requests', async () => {
    const client = createMockClient([[{ id: REQUEST_ID, teacher_id: TEACHER_ID, status: 'pending' }]]);

    const row = await createGenerationRequest(
      { teacherId: TEACHER_ID, requestPayload: SAMPLE_INPUT },
      client,
    );

    assert.match(client.calls[0].sql, /INSERT INTO generation_requests/i);
    assert.equal(client.calls[0].params?.[0], TEACHER_ID);
    assert.equal(client.calls[0].params?.[2], 'pending');
    assert.equal(row.id, REQUEST_ID);
  });

  it('updateGenerationRequestStatus updates status and metrics', async () => {
    const client = createMockClient([[{ id: REQUEST_ID, status: 'success' }]]);

    const row = await updateGenerationRequestStatus(
      REQUEST_ID,
      'success',
      {
        modelUsed: 'claude-sonnet-5',
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
        latencyMs: 1200,
      },
      client,
    );

    assert.match(client.calls[0].sql, /UPDATE generation_requests/i);
    assert.equal(client.calls[0].params?.[1], 'success');
    assert.equal(client.calls[0].params?.[2], 'claude-sonnet-5');
    assert.equal(row?.status, 'success');
  });

  it('createDraft inserts into generation_drafts', async () => {
    const client = createMockClient([[{ id: DRAFT_ID, request_id: REQUEST_ID, teacher_id: TEACHER_ID }]]);

    const row = await createDraft(
      {
        requestId: REQUEST_ID,
        teacherId: TEACHER_ID,
        questions: [{ id: 'q1', text: 'Sample?', correctAnswer: 'A', difficulty: 'easy' }],
      },
      client,
    );

    assert.match(client.calls[0].sql, /INSERT INTO generation_drafts/i);
    assert.equal(client.calls[0].params?.[0], REQUEST_ID);
    assert.equal(client.calls[0].params?.[1], TEACHER_ID);
    assert.equal(row.id, DRAFT_ID);
  });

  it('getDraftById selects by draft id', async () => {
    const client = createMockClient([[{ id: DRAFT_ID }]]);

    const row = await getDraftById(DRAFT_ID, client);

    assert.match(client.calls[0].sql, /FROM generation_drafts/i);
    assert.match(client.calls[0].sql, /WHERE id = \$1::uuid/i);
    assert.equal(client.calls[0].params?.[0], DRAFT_ID);
    assert.equal(row?.id, DRAFT_ID);
  });

  it('updateDraft updates provided draft fields', async () => {
    const client = createMockClient([[{ id: DRAFT_ID, status: 'draft' }]]);

    const row = await updateDraft(
      DRAFT_ID,
      { questions: [{ id: 'q2', text: 'Updated?', correctAnswer: 'B', difficulty: 'medium' }] },
      client,
    );

    assert.match(client.calls[0].sql, /UPDATE generation_drafts/i);
    assert.match(client.calls[0].sql, /questions = \$2::jsonb/i);
    assert.equal(client.calls[0].params?.[0], DRAFT_ID);
    assert.equal(row?.id, DRAFT_ID);
  });

  it('listDraftsByTeacher filters by teacher and optional status', async () => {
    const client = createMockClient([[{ id: DRAFT_ID, status: 'draft' }]]);

    const rows = await listDraftsByTeacher(TEACHER_ID, 'draft', client);

    assert.match(client.calls[0].sql, /FROM generation_drafts/i);
    assert.match(client.calls[0].sql, /teacher_id = \$1::uuid/i);
    assert.equal(client.calls[0].params?.[0], TEACHER_ID);
    assert.equal(client.calls[0].params?.[1], 'draft');
    assert.equal(rows.length, 1);
  });

  it('updateDraftStatus delegates to updateDraft with status', async () => {
    const client = createMockClient([[{ id: DRAFT_ID, status: 'published' }]]);

    const row = await updateDraftStatus(DRAFT_ID, 'published', client);

    assert.match(client.calls[0].sql, /UPDATE generation_drafts/i);
    assert.match(client.calls[0].sql, /status = \$2/i);
    assert.equal(client.calls[0].params?.[1], 'published');
    assert.equal(row?.status, 'published');
  });
});
