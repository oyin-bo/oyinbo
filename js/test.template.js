// @ts-check

/**
 * Format milliseconds as HH:MM:SS time string
 * @param {number} ms
 * @returns {string}
 */
export function clockFmt(ms) {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
}

/**
 * Format duration with thousand separators and appropriate units
 * @param {number} ms Duration in milliseconds
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 2000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${parseFloat(seconds).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}s`;
}

/**
 * Format test results header line
 * @param {{pass: number, fail: number, skip: number}} totals
 * @param {number} duration Duration in milliseconds
 * @param {boolean} complete Whether test run is complete
 * @param {{pass?: number, fail?: number, skip?: number} | null} deltas Optional delta counts since last update
 * @returns {string}
 */
export function formatTestResultsHeader(totals, duration, complete = true, deltas = null) {
  const durationStr = formatDuration(duration);
  
  if (complete) {
    return `## Test Results: ${totals.pass} pass, ${totals.fail} fail, ${totals.skip} skip (${durationStr})`;
  }
  
  // Progress update with deltas
  if (deltas && ((deltas.pass ?? 0) > 0 || (deltas.fail ?? 0) > 0 || (deltas.skip ?? 0) > 0)) {
    let deltaStr = '';
    if ((deltas.pass ?? 0) > 0) deltaStr += `+${deltas.pass} pass`;
    if ((deltas.fail ?? 0) > 0) deltaStr += (deltaStr ? ', ' : '') + `+${deltas.fail} fail`;
    if ((deltas.skip ?? 0) > 0) deltaStr += (deltaStr ? ', ' : '') + `+${deltas.skip} skip`;
    return `## Test Progress: ${totals.pass}/${totals.pass + totals.fail} pass, ${deltaStr} (${durationStr})`;
  }
  
  return `## Test Progress: ${totals.pass}/${totals.pass + totals.fail} pass, ${totals.fail} fail (${durationStr})`;
}

/**
 * Format a single test item with result indicator
 * @param {{
 *   name: string,
 *   suite?: string,
 *   status: 'pass' | 'fail' | 'skip',
 *   duration: number,
 *   error?: string,
 *   completedAt?: number,
 *   fullTs?: string
 * }} test
 * @returns {string[]} Array of formatted lines for this test
 */
export function formatTestItem(test) {
  const lines = [];
  const suite = test.suite ? `${test.suite} > ` : '';
  const ts = test.fullTs || (test.completedAt ? clockFmt(test.completedAt) : '');
  
  const indicator = test.status === 'pass' ? '✓' : test.status === 'fail' ? '✗' : '○';
  const line = `${indicator} ${suite}${test.name} ${ts} (${test.duration}ms)`;
  lines.push(line);
  
  if (test.error) {
    lines.push(`\`\`\``);
    lines.push(...test.error.split('\n'));
    lines.push(`\`\`\``);
  }
  
  return lines;
}

/**
 * Format test progress as markdown
 * @param {{
 *   totals: {pass: number, fail: number, skip: number},
 *   duration: number,
 *   recentTests?: Array<any>,
 *   allTests?: Array<any>,
 *   complete?: boolean,
 *   deltas?: {pass?: number, fail?: number, skip?: number} | null
 * }} payload Test progress data
 * @returns {string}
 */
export function formatTestProgress(payload) {
  const { totals, duration, recentTests, allTests, complete = false, deltas = null } = payload;
  const lines = [];
  
  lines.push(formatTestResultsHeader(totals, duration, complete, deltas));
  lines.push('');
  
  // For final results, use allTests; for progress updates, use recentTests
  const testsToShow = complete && allTests ? allTests : recentTests;
  
  if (testsToShow && testsToShow.length > 0) {
    // Separate failed, skipped, and passed tests for better visibility
    const failedTests = testsToShow.filter(t => t.status === 'fail');
    const skippedTests = testsToShow.filter(t => t.status === 'skip');
    const passedTests = testsToShow.filter(t => t.status === 'pass');
    
    // Show failures first (most important)
    for (const test of failedTests) {
      lines.push(...formatTestItem(test));
    }
    
    // Show skipped tests
    for (const test of skippedTests) {
      lines.push(...formatTestItem(test));
    }
    
    // Show passed tests
    for (const test of passedTests) {
      lines.push(...formatTestItem(test));
    }
  }
  
  return lines.join('\n');
}
