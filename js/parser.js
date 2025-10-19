// @ts-check

/**
 * @typedef {{
 *   agent: string,
 *   target: string,
 *   time: string,
 *   code: string,
 *   hasFooter: boolean
 * }} Request
 */

/** @param {string} text @param {string} pageName @returns {Request | null} */
export function parseRequest(text, pageName) {
  const lines = text.split('\n');
  let footerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) 
    if (lines[i].startsWith('> Write code in a fenced JS block')) { footerIdx = i; break; }
  
  if (footerIdx >= 0) {
    const chunk = lines.slice(footerIdx + 1).join('\n');
    if (!chunk.trim()) return null;
    const agentRe = /^>\s*\*\*(\S+)\*\*\s+to\s+(\S+)\s+at\s+(\d{2}:\d{2}:\d{2})\s*$/;
    const headerMatch = agentRe.exec(lines[footerIdx + 1]);
    const codeChunk = lines.slice(footerIdx + 1 + (headerMatch ? 1 : 0)).join('\n');
    const codeMatch = /```(?:\s*(?:js|javascript))?\s*\n([\s\S]*?)```/i.exec(codeChunk);
    if (!codeMatch?.[1]?.trim()) return null;
    const code = codeMatch[1].endsWith('\n') ? codeMatch[1].slice(0, -1) : codeMatch[1];
    return { 
      agent: headerMatch?.[1] || 'agent',
      target: headerMatch?.[2] || pageName,
      time: headerMatch?.[3] || '',
      code: code,
      hasFooter: true 
    };
  }

  // No footer: seek last fenced block
  const codeRe = /```(?:\s*(?:js|javascript))?\s*\n([\s\S]*?)```/ig;
  let lastMatch = null, m;
  while ((m = codeRe.exec(text)) !== null) 
    lastMatch = { code: m[1], index: m.index };
  if (!lastMatch) return null;

  // Check for page reply header above
  const before = text.slice(0, lastMatch.index).split('\n');
  let idx = before.length - 1;
  while (idx >= 0 && !before[idx].trim()) idx--;
  if (idx >= 0) {
    const escName = pageName.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp('^>\\s*\\*\\*' + escName + '\\*\\*\\s+to\\s+\\S+\\s+at\\s+\\d{2}:\\d{2}:\\d{2}').test(before[idx].trim())) 
      return null;
  }

  const code = lastMatch.code.endsWith('\n') ? lastMatch.code.slice(0, -1) : lastMatch.code;
  return { agent: 'agent', target: pageName, time: '', code: code, hasFooter: false };
}
