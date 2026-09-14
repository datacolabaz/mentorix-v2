const { LiveLessonProvider } = require('./LiveLessonProvider');

/** Phase 2 stub — not implemented. */
class ZoomProvider extends LiveLessonProvider {
  get id() {
    return 'zoom';
  }

  async isConnected() {
    return false;
  }

  async createMeeting() {
    const err = new Error('Zoom hələ aktiv deyil');
    err.status = 501;
    err.code = 'PROVIDER_NOT_IMPLEMENTED';
    throw err;
  }

  async updateMeeting() {
    return this.createMeeting();
  }

  async cancelMeeting() {
    return this.createMeeting();
  }

  async getMeeting() {
    return this.createMeeting();
  }
}

module.exports = { ZoomProvider };
