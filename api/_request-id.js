const safeRequestId = /^[A-Za-z0-9_-]{1,128}$/;

export function sanitizeRequestId(value) {
  return typeof value === 'string' && safeRequestId.test(value) ? value : 'unknown';
}
