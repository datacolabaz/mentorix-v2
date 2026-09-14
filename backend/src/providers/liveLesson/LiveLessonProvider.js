/**
 * Live lesson provider contract.
 * Controllers must call registry.get(id) — no provider if-else in HTTP layer.
 */

class LiveLessonProvider {
  /** @returns {'mentorix_live'|'google_meet'|'zoom'|'teams'} */
  get id() {
    throw new Error('LiveLessonProvider.id must be implemented');
  }

  /** @param {string} instructorId */
  async isConnected(instructorId) {
    void instructorId;
    throw new Error('LiveLessonProvider.isConnected must be implemented');
  }

  /**
   * @param {string} instructorId
   * @param {object} input
   * @param {string} input.title
   * @param {string} [input.scheduledAt]
   * @param {number} [input.durationMinutes]
   * @param {string[]} [input.attendeeEmails]
   * @param {object} [input.metadata]
   */
  async createMeeting(instructorId, input) {
    void instructorId;
    void input;
    throw new Error('LiveLessonProvider.createMeeting must be implemented');
  }

  async updateMeeting(instructorId, providerMeetingId, patch) {
    void instructorId;
    void providerMeetingId;
    void patch;
    throw new Error('LiveLessonProvider.updateMeeting must be implemented');
  }

  async cancelMeeting(instructorId, providerMeetingId) {
    void instructorId;
    void providerMeetingId;
    throw new Error('LiveLessonProvider.cancelMeeting must be implemented');
  }

  async getMeeting(instructorId, providerMeetingId) {
    void instructorId;
    void providerMeetingId;
    throw new Error('LiveLessonProvider.getMeeting must be implemented');
  }
}

module.exports = { LiveLessonProvider };
