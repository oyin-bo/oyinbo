// @ts-check

import { parseRequest as parseRequestImpl } from './repl.template.js';

/**
 * @typedef {{
 *   agent: string,
 *   target: string,
 *   time: string,
 *   code: string,
 *   hasFooter: boolean
 * }} Request
 */

/**
 * Parse a REPL request from markdown text
 * @param {string} text
 * @param {string} pageName
 * @returns {Request | null}
 */
export function parseRequest(text, pageName) {
  return parseRequestImpl(text, pageName);
}
