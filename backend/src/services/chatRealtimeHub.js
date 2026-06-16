const { EventEmitter } = require('events');

/** In-process pub/sub for chat room SSE streams (single Railway instance). */
const rooms = new Map();

function getEmitter(roomId) {
  const key = String(roomId);
  if (!rooms.has(key)) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    rooms.set(key, emitter);
  }
  return rooms.get(key);
}

function publishChatMessage(roomId, message) {
  if (!roomId || !message) return;
  getEmitter(roomId).emit('message', message);
}

function subscribeRoom(roomId, listener) {
  if (!roomId || typeof listener !== 'function') return;
  getEmitter(roomId).on('message', listener);
}

function unsubscribeRoom(roomId, listener) {
  if (!roomId || typeof listener !== 'function') return;
  getEmitter(roomId).off('message', listener);
}

module.exports = {
  publishChatMessage,
  subscribeRoom,
  unsubscribeRoom,
};
