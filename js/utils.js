// @ts-check

/** @param {string} name */
export function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** @param {number} ms */
export function clockFmt(ms) {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
}

/** @param {number} ms */
export function durationFmt(ms) {
  return ms >= 2000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
