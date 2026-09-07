const {
  getPresentationState,
  setPresentationState,
  createPoll,
  respondPoll,
  closePoll,
  getOpenPresentationFile,
} = require('../services/livePresentationService');

function sendErr(res, e) {
  const status = e.status || 500;
  res.status(status).json({ success: false, message: e.message || 'Xəta' });
}

const getState = async (req, res) => {
  try {
    const state = await getPresentationState(req.params.roomCode, req.user);
    res.json({
      success: true,
      presentation: state.presentation,
      slide_index: state.slide_index,
      annotations: state.annotations,
      poll: state.poll,
    });
  } catch (e) {
    sendErr(res, e);
  }
};

const putState = async (req, res) => {
  try {
    const state = await setPresentationState(req.params.roomCode, req.user, {
      presentationId: Object.prototype.hasOwnProperty.call(req.body || {}, 'presentation_id')
        ? req.body.presentation_id
        : undefined,
      slideIndex: req.body?.slide_index,
      close: Boolean(req.body?.close),
    });
    res.json({
      success: true,
      presentation: state.presentation,
      slide_index: state.slide_index,
      annotations: state.annotations,
      poll: state.poll,
    });
  } catch (e) {
    sendErr(res, e);
  }
};

const postPoll = async (req, res) => {
  try {
    const poll = await createPoll(req.params.roomCode, req.user, req.body);
    res.json({ success: true, poll });
  } catch (e) {
    sendErr(res, e);
  }
};

const postPollRespond = async (req, res) => {
  try {
    const poll = await respondPoll(req.params.roomCode, req.user, req.params.pollId, req.body?.option_id);
    res.json({ success: true, poll });
  } catch (e) {
    sendErr(res, e);
  }
};

const postPollClose = async (req, res) => {
  try {
    const poll = await closePoll(req.params.roomCode, req.user, req.params.pollId);
    res.json({ success: true, poll });
  } catch (e) {
    sendErr(res, e);
  }
};

const serveOpenFile = async (req, res) => {
  try {
    const { hit, presentation } = await getOpenPresentationFile(req.params.roomCode, req.user);
    const downloadName = presentation.original_filename || presentation.title || 'presentation.pdf';
    const safeName = String(downloadName).replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=120');
    return res.send(hit.buffer);
  } catch (e) {
    sendErr(res, e);
  }
};

module.exports = {
  getState,
  putState,
  postPoll,
  postPollRespond,
  postPollClose,
  serveOpenFile,
};
