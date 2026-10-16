const { randomUUID } = require('node:crypto');

function sampleQuestion(type, subjectId) {
  const option = (label, side) => ({
    id: randomUUID(), option_text: label, metadata: side ? { side } : {},
  });
  const q = {
    subject_id: subjectId, question_text: `Question ${type}`, question_type: type,
    status: 'published', points: 2, difficulty: 'medium', explanation: 'PRIVATE_EXPLANATION', options: [],
  };
  let answer;
  if (type === 'single_choice' || type === 'multiple_choice' || type === 'ordering') {
    q.options = [option('First'), option('Second'), option('Third')];
    const ids = q.options.map(o => o.id);
    if (type === 'single_choice') { q.answer_key = { option_id: ids[1] }; answer = ids[1]; }
    if (type === 'multiple_choice') { q.answer_key = { option_ids: [ids[0], ids[2]] }; answer = [ids[2], ids[0]]; }
    if (type === 'ordering') { q.answer_key = { order: [ids[2], ids[0], ids[1]] }; answer = q.answer_key.order; }
  }
  if (type === 'true_false') { q.answer_key = { value: false }; answer = false; }
  if (type === 'short_answer') { q.answer_key = { accepted_answers: ['PRIVATE_ACCEPTED'], case_sensitive: false }; answer = ' private_accepted '; }
  if (type === 'numeric') { q.answer_key = { accepted_values: [0, 2.5], tolerance: 0.01 }; answer = 0; }
  if (type === 'matching') {
    q.options = [option('L1', 'left'), option('L2', 'left'), option('R1', 'right'), option('R2', 'right')];
    const ids = q.options.map(o => o.id);
    q.answer_key = { pairs: { [ids[0]]: ids[3], [ids[1]]: ids[2] } };
    answer = q.answer_key.pairs;
  }
  if (type === 'open_answer') { q.answer_key = {}; answer = 'My written solution'; }
  if (type === 'file_upload') { q.answer_key = {}; answer = null; }
  return { q, answer };
}
module.exports = { sampleQuestion };
