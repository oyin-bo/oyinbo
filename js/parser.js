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
  
  if (footerIdx < 0) return null;
  
  // Look for content BELOW footer
  const chunk = lines.slice(footerIdx + 1).join('\n');
  if (!chunk.trim()) return null;
  
  // Parse optional agent header
  const agentRe = /^>\s*\*\*(\S+)\*\*\s+to\s+(\S+)\s+at\s+(\d{2}:\d{2}:\d{2})\s*$/;
  const headerMatch = agentRe.exec(lines[footerIdx + 1]);
  
  const agent = headerMatch?.[1] || 'agent';
  const target = headerMatch?.[2] || pageName;
  const time = headerMatch?.[3] || '';
  
  // Extract code from fenced block
  const codeChunk = lines.slice(footerIdx + 1 + (headerMatch ? 1 : 0)).join('\n');
  const codeMatch = /```(?:JS|js|javascript)\s*\n([\s\S]*?)```/.exec(codeChunk);
  
  if (!codeMatch?.[1]?.trim()) return null;
  
  return { agent, target, time, code: codeMatch[1], hasFooter: true };
}
