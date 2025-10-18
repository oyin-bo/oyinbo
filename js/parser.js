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
  
  // Find footer from bottom
  let footerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('> Write code in a fenced JS block')) {
      footerIdx = i;
      break;
    }
  }
  
  // If footer exists, look for content BELOW footer
  if (footerIdx >= 0) {
    const chunk = lines.slice(footerIdx + 1).join('\n');
    if (!chunk.trim()) return null;

    const agentRe = /^>\s*\*\*(\S+)\*\*\s+to\s+(\S+)\s+at\s+(\d{2}:\d{2}:\d{2})\s*$/;
    const headerMatch = agentRe.exec(lines[footerIdx + 1]);

    const agent = headerMatch?.[1] || 'agent';
    const target = headerMatch?.[2] || pageName;
    const time = headerMatch?.[3] || '';

  const codeChunk = lines.slice(footerIdx + 1 + (headerMatch ? 1 : 0)).join('\n');
  // Accept fenced blocks with optional language (none, js, or javascript)
  const codeMatch = /```(?:\s*(?:js|javascript))?\s*\n([\s\S]*?)```/i.exec(codeChunk);

    if (!codeMatch?.[1]?.trim()) return null;

    return { agent, target, time, code: codeMatch[1], hasFooter: true };
  }

  // No footer: tolerate agent-created files that lack the footer.
  // Seek the last fenced JS block in the file and ensure there is no page reply header after it.
  const allText = text;
  // Accept fenced blocks with optional language (none, js, or javascript)
  const codeRe = /```(?:\s*(?:js|javascript))?\s*\n([\s\S]*?)```/ig;
  let lastMatch = null;
  let m;
  while ((m = codeRe.exec(allText)) !== null) lastMatch = { match: m[0], code: m[1], index: m.index, lastIndex: codeRe.lastIndex };
  if (!lastMatch) return null;

  // Check for a page reply header directly ABOVE the fenced block (allow
  // whitespace/newlines between). If found, this fenced block is likely a
  // response and should NOT be treated as a new request.
  const before = allText.slice(0, lastMatch.index);
  const beforeLines = before.split('\n');
  // Walk backwards skipping blank lines to find nearest non-empty line
  let idx = beforeLines.length - 1;
  while (idx >= 0 && !beforeLines[idx].trim()) idx--;
  if (idx >= 0) {
    const candidate = beforeLines[idx].trim();
    const escName = pageName.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
    const pageReplyRe = new RegExp('^>\\s*\\*\\*' + escName + '\\*\\*\\s+to\\s+\\S+\\s+at\\s+\\d{2}:\\d{2}:\\d{2}');
    if (pageReplyRe.test(candidate)) return null;
  }

  // Treat the last fenced block as a REPL request
  return { agent: 'agent', target: pageName, time: '', code: lastMatch.code, hasFooter: false };
}
