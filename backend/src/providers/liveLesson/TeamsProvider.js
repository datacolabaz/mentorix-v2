const { LiveLessonProvider } = require('./LiveLessonProvider');

/** Phase 3 stub — not implemented. */
class TeamsProvider extends LiveLessonProvider {
  get id() {
    return 'teams';
  }

  async isConnected() {
    return false;
  }

  async createMeeting() {
    const err = new Error('Microsoft Teams hələ aktiv deyil');
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

module.exports = { TeamsProvider };
