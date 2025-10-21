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
 * Format test results header line
 * @param {{pass: number, fail: number, skip: number}} totals
 * @param {number} duration Duration in milliseconds
 * @param {boolean} complete Whether test run is complete
 * @returns {string}
 */
export function formatTestResultsHeader(totals, duration, complete = true) {
  if (complete) {
    return `## Test Results: ${totals.pass} pass, ${totals.fail} fail, ${totals.skip} skip (${duration}ms)`;
  }
  return `## Test Progress: ${totals.pass}/${totals.pass + totals.fail} pass, ${totals.fail} fail (${duration}ms)`;
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
    lines.push(test.error.split('\n').map(l => `  ${l}`).join('\n'));
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
 *   complete?: boolean
 * }} payload Test progress data
 * @returns {string}
 */
export function formatTestProgress(payload) {
  const { totals, duration, recentTests, allTests, complete = false } = payload;
  const lines = [];
  
  lines.push(formatTestResultsHeader(totals, duration, complete));
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
