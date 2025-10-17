// @ts-check

const AGENT_RE = /^>\s*\*\*(\S+)\*\*\s+to\s+(\S+)\s+at\s+(\d{2}:\d{2}:\d{2})\s*$/;
const FOOTER_RE = /^>\s+Write code in a fenced JS block/;

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
  
  // Find footer from bottom
  for (let i = lines.length - 1; i >= 0; i--) {
    if (FOOTER_RE.test(lines[i])) {
      footerIdx = i;
      break;
    }
  }
  
  if (footerIdx < 0) {
    console.log(`[parseRequest] ${pageName}: no footer found in ${lines.length} lines`);
    return null;
  }
  
  // Look for content BELOW the footer (agent appends below)
  const chunk = lines.slice(footerIdx + 1).join('\n');
  if (!chunk.trim()) {
    console.log(`[parseRequest] ${pageName}: no content below footer`);
    return null;
  }
  
  // Check if there's an agent header
  let agent = 'agent';
  let target = pageName;
  let time = '';
  let codeStartIdx = 0;
  
  const headerMatch = AGENT_RE.exec(lines[footerIdx + 1]);
  if (headerMatch) {
    agent = headerMatch[1];
    target = headerMatch[2];
    time = headerMatch[3];
    codeStartIdx = 1; // Skip the header line
  }
  
  // Extract code from fenced block(s) below the footer (and optional header)
  const codeChunk = lines.slice(footerIdx + 1 + codeStartIdx).join('\n');
  const fence = /```(?:JS|js|javascript)\s*\n([\s\S]*?)```/;
  const fm = fence.exec(codeChunk);
  
  if (!fm || !fm[1].trim()) {
    console.log(`[parseRequest] ${pageName}: no code block found below footer`);
    return null;
  }
  
  console.log(`[parseRequest] ${pageName}: found request with agent=${agent}, code length=${fm[1].length}`);
  return {
    agent,
    target,
    time,
    code: fm[1],
    hasFooter: true
  };
}

/** @param {string} text @returns {boolean} */
export function hasFooter(text) {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (FOOTER_RE.test(lines[i])) return true;
    if (lines[i].trim() && !lines[i].startsWith('>')) break;
  }
  return false;
}

/** @param {string} text */
export function removeFooter(text) {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (FOOTER_RE.test(lines[i])) {
      return lines.slice(0, i).join('\n') + '\n';
    }
  }
  return text;
}

/** @param {string} text */
export function removeFooterAndBelow(text) {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (FOOTER_RE.test(lines[i])) {
      // Remove footer and everything below it
      return lines.slice(0, i).join('\n') + '\n';
    }
  }
  return text;
}
