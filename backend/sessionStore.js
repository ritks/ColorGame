const sessions = {};

export function createSession(sessionId, data) {
  sessions[sessionId] = data;
}

export function getSession(sessionId) {
  return sessions[sessionId];
}

export function updateSession(sessionId, updates) {
  if (sessions[sessionId]) {
    sessions[sessionId] = { ...sessions[sessionId], ...updates };
  }
}

export function deleteSession(sessionId) {
  delete sessions[sessionId];
}
