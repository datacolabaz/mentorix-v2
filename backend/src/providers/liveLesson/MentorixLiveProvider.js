const { LiveLessonProvider } = require('./LiveLessonProvider');

/**
 * Mentorix Live (LiveKit) — always "connected"; meeting creation is handled by
 * liveRoomService inside orchestration (no external OAuth).
 */
class MentorixLiveProvider extends LiveLessonProvider {
  get id() {
    return 'mentorix_live';
  }

  async isConnected() {
    return true;
  }

  async createMeeting(_instructorId, input = {}) {
    return {
      providerMeetingId: null,
      joinUrl: null,
      startUrl: null,
      passcode: null,
      raw: { title: input.title || null },
      connectionId: null,
    };
  }

  async updateMeeting() {
    return null;
  }

  async cancelMeeting() {
    return null;
  }

  async getMeeting() {
    return null;
  }
}

module.exports = { MentorixLiveProvider };
