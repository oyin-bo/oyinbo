// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest } from './parser.js';

test('parseRequest extracts code from footer-based request with agent header', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    'console.log("hello")',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'console.log("hello")');
});

test('parseRequest extracts agent from header', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '> **alice** to test-page at 12:34:56',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.agent, 'alice');
});

test('parseRequest extracts target from header', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '> **agent** to my-page at 12:34:56',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.target, 'my-page');
});

test('parseRequest extracts time from header', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.time, '12:34:56');
});

test('parseRequest sets hasFooter true for footer-based request', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.hasFooter, true);
});

test('parseRequest returns complete object for footer-based request', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '> **bob** to page-1 at 09:15:30',
    '```js',
    '1 + 1',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'page-1');
  
  assert.deepStrictEqual(result, {
    agent: 'bob',
    target: 'page-1',
    time: '09:15:30',
    code: '1 + 1',
    hasFooter: true
  });
});

test('parseRequest defaults agent to "agent" when header missing', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.agent, 'agent');
});

test('parseRequest defaults target to pageName when header missing', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'my-test-page');
  
  assert.strictEqual(result.target, 'my-test-page');
});

test('parseRequest defaults time to empty string when header missing', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.time, '');
});

test('parseRequest returns null when chunk after footer is empty', () => {
  const input = '> Append your JavaScript snippet below\n   \n';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when chunk after footer is whitespace only', () => {
  const input = '> Append your JavaScript snippet below\n\n  \t  \n';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence is empty', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    '   ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence contains only whitespace', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    '  \n  \t  \n  ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest accepts fence with "javascript" language tag', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```javascript',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'const x = 1;');
});

test('parseRequest accepts fence with no language tag', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'const x = 1;');
});

test('parseRequest extracts last fenced block when no footer', () => {
  const input = [
    '```js',
    'first',
    '```',
    'some text',
    '```js',
    'second',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'second');
});

test('parseRequest sets hasFooter false for no-footer request', () => {
  const input = [
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.hasFooter, false);
});

test('parseRequest returns null when page reply header above fence', () => {
  const input = [
    '> **test-page** to agent at 12:34:56 (10ms)',
    '```JSON',
    '42',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when page reply header above fence with blank lines', () => {
  const input = [
    '> **test-page** to agent at 12:34:56 (10ms)',
    '',
    '',
    '```JSON',
    '42',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when no fenced block found', () => {
  const input = 'just some text without any code blocks';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest handles multiline code correctly', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    'function test() {',
    '  return 42;',
    '}',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'function test() {\n  return 42;\n}');
});

test('parseRequest preserves whitespace in code', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    '  indented  ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, '  indented  ');
});

test('parseRequest returns null when fence contains only a response header', () => {
  const input = [
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    '> **test-page** to agent at 12:34:57 (**ERROR**) (5ms)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence contains response header with extra text', () => {
  const input = [
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    '> **test-page** to agent at 12:34:57',
    'some more text',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// No-footer scenario tests (user deleted footer)
test('parseRequest handles no-footer scenario with valid code', () => {
  const input = [
    '> **agent** to test-page at 12:34:56',
    '```JS',
    '2+3',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.deepStrictEqual(result, {
    agent: 'agent',
    target: 'test-page',
    time: '',
    code: '2+3',
    hasFooter: false
  });
});

test('parseRequest no-footer finds last fence among multiple blocks', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    'first',
    '```',
    '',
    '> **test-page** to agent at 12:00:01 (5ms)',
    '```JSON',
    '"result"',
    '```',
    '',
    'some separator text',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    'second',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, 'second');
  assert.strictEqual(result.hasFooter, false);
});

test('parseRequest no-footer rejects response header in fence', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    '2+3',
    '```',
    '',
    '> **test-page** to agent at 12:00:01 (5ms)',
    '```JSON',
    '5',
    '```',
    '',
    'some text',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '> **test-page** to agent at 12:01:01 (**ERROR**) (5ms)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest no-footer accepts code after error response', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    '> **test-page** to agent at 12:00:01 (**ERROR**) (5ms)',
    '```',
    '',
    '> **test-page** to agent at 12:00:02 (**ERROR**) (3ms)',
    '```Error',
    'SyntaxError: ...',
    '```',
    '',
    'some text',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '5*7',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, '5*7');
  assert.strictEqual(result.hasFooter, false);
});

// Footer-based scenario tests with response headers in earlier fences
test('parseRequest with-footer ignores earlier fence with response header', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    '> **test-page** to agent at 11:59:59',
    '```',
    '',
    '> **test-page** to agent at 12:00:01 (**ERROR**) (5ms)',
    '```Error',
    'SyntaxError: ...',
    '```',
    '',
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '3*4',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, '3*4');
  assert.strictEqual(result.hasFooter, true);
});

test('parseRequest with-footer rejects response header in target fence', () => {
  const input = [
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '> **test-page** to agent at 12:00:59',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Real-world scenario: user deletes response but leaves header in fence
test('parseRequest rejects when user accidentally leaves response header in code fence', () => {
  const input = [
    '> **agent** to test-page at 17:23:37',
    '```JS',
    '2+3',
    '```',
    '',
    '> **test-page** to agent at 17:23:38 (7ms)',
    '```JSON',
    '5',
    '```',
    '',
    'some separator',
    '',
    '> **agent** to test-page at 17:24:00',
    '```JS',
    '> **test-page** to agent at 17:23:38 (7ms)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Edge case: multiple response headers
test('parseRequest rejects fence starting with any response header pattern', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    '> **any-page** to another-agent at 00:00:00',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Valid code that happens to contain markdown-like text
test('parseRequest accepts code with markdown-like comments', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    '// This is a comment, not a markdown header',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, '// This is a comment, not a markdown header\nconst x = 1;');
});

test('parseRequest rejects code starting with exact response header pattern', () => {
  const input = [
    '> Append your JavaScript snippet below',
    '```js',
    '> **page-name** to agent-name',
    'more code',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Complete scenario tests
test('parseRequest handles complete session with footer', () => {
  const input = [
    '> **agent** to test-page at 10:00:00',
    '```JS',
    '1+1',
    '```',
    '',
    '> **test-page** to agent at 10:00:01 (5ms)',
    '```JSON',
    '2',
    '```',
    '',
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below',
    '> **bob** to test-page at 10:01:00',
    '```javascript',
    'Math.sqrt(16)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.deepStrictEqual(result, {
    agent: 'bob',
    target: 'test-page',
    time: '10:01:00',
    code: 'Math.sqrt(16)',
    hasFooter: true
  });
});

test('parseRequest handles complete session without footer after response deletion', () => {
  const input = [
    '> **agent** to test-page at 10:00:00',
    '```JS',
    '1+1',
    '```',
    '',
    '> **test-page** to agent at 10:00:01 (5ms)',
    '```JSON',
    '2',
    '```',
    '',
    'separator text',
    '',
    '> **agent** to test-page at 10:01:00',
    '```JS',
    '3+3',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.deepStrictEqual(result, {
    agent: 'agent',
    target: 'test-page',
    time: '',
    code: '3+3',
    hasFooter: false
  });
});

test('parseRequest extracts agent from header', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '> **alice** to test-page at 12:34:56',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.agent, 'alice');
});

test('parseRequest extracts target from header', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '> **agent** to my-page at 12:34:56',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.target, 'my-page');
});

test('parseRequest extracts time from header', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.time, '12:34:56');
});

test('parseRequest sets hasFooter true for footer-based request', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.hasFooter, true);
});

test('parseRequest returns complete object for footer-based request', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '> **bob** to page-1 at 09:15:30',
    '```js',
    '1 + 1',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'page-1');
  
  assert.deepStrictEqual(result, {
    agent: 'bob',
    target: 'page-1',
    time: '09:15:30',
    code: '1 + 1',
    hasFooter: true
  });
});

test('parseRequest defaults agent to "agent" when header missing', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.agent, 'agent');
});

test('parseRequest defaults target to pageName when header missing', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'my-test-page');
  
  assert.strictEqual(result.target, 'my-test-page');
});

test('parseRequest defaults time to empty string when header missing', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.time, '');
});

test('parseRequest returns null when chunk after footer is empty', () => {
  const input = '> Append your JavaScript snippet below below\n   \n';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when chunk after footer is whitespace only', () => {
  const input = '> Append your JavaScript snippet below below\n\n  \t  \n';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence is empty', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    '   ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence contains only whitespace', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    '  \n  \t  \n  ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest accepts fence with "javascript" language tag', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```javascript',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'const x = 1;');
});

test('parseRequest accepts fence with no language tag', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'const x = 1;');
});

test('parseRequest extracts last fenced block when no footer', () => {
  const input = [
    '```js',
    'first',
    '```',
    'some text',
    '```js',
    'second',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'second');
});

test('parseRequest sets hasFooter false for no-footer request', () => {
  const input = [
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.hasFooter, false);
});

test('parseRequest returns null when page reply header above fence', () => {
  const input = [
    '> **test-page** to agent at 12:34:56 (10ms)',
    '```JSON',
    '42',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when page reply header above fence with blank lines', () => {
  const input = [
    '> **test-page** to agent at 12:34:56 (10ms)',
    '',
    '',
    '```JSON',
    '42',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when no fenced block found', () => {
  const input = 'just some text without any code blocks';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest handles multiline code correctly', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    'function test() {',
    '  return 42;',
    '}',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'function test() {\n  return 42;\n}');
});

test('parseRequest preserves whitespace in code', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    '  indented  ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, '  indented  ');
});

test('parseRequest returns null when fence contains only a response header', () => {
  const input = [
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    '> **test-page** to agent at 12:34:57 (**ERROR**) (5ms)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence contains response header with extra text', () => {
  const input = [
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    '> **test-page** to agent at 12:34:57',
    'some more text',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// No-footer scenario tests (user deleted footer)
test('parseRequest handles no-footer scenario with valid code', () => {
  const input = [
    '> **agent** to test-page at 12:34:56',
    '```JS',
    '2+3',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.deepStrictEqual(result, {
    agent: 'agent',
    target: 'test-page',
    time: '',
    code: '2+3',
    hasFooter: false
  });
});

test('parseRequest no-footer finds last fence among multiple blocks', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    'first',
    '```',
    '',
    '> **test-page** to agent at 12:00:01 (5ms)',
    '```JSON',
    '"result"',
    '```',
    '',
    'some separator text',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    'second',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, 'second');
  assert.strictEqual(result.hasFooter, false);
});

test('parseRequest no-footer rejects response header in fence', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    '2+3',
    '```',
    '',
    '> **test-page** to agent at 12:00:01 (5ms)',
    '```JSON',
    '5',
    '```',
    '',
    'some text',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '> **test-page** to agent at 12:01:01 (**ERROR**) (5ms)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest no-footer accepts code after error response', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    '> **test-page** to agent at 12:00:01 (**ERROR**) (5ms)',
    '```',
    '',
    '> **test-page** to agent at 12:00:02 (**ERROR**) (3ms)',
    '```Error',
    'SyntaxError: ...',
    '```',
    '',
    'some text',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '5*7',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, '5*7');
  assert.strictEqual(result.hasFooter, false);
});

// Footer-based scenario tests with response headers in earlier fences
test('parseRequest with-footer ignores earlier fence with response header', () => {
  const input = [
    '> **agent** to test-page at 12:00:00',
    '```JS',
    '> **test-page** to agent at 11:59:59',
    '```',
    '',
    '> **test-page** to agent at 12:00:01 (**ERROR**) (5ms)',
    '```Error',
    'SyntaxError: ...',
    '```',
    '',
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below below',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '3*4',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, '3*4');
  assert.strictEqual(result.hasFooter, true);
});

test('parseRequest with-footer rejects response header in target fence', () => {
  const input = [
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below below',
    '',
    '> **agent** to test-page at 12:01:00',
    '```JS',
    '> **test-page** to agent at 12:00:59',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Real-world scenario: user deletes response but leaves header in fence
test('parseRequest rejects when user accidentally leaves response header in code fence', () => {
  const input = [
    '> **agent** to test-page at 17:23:37',
    '```JS',
    '2+3',
    '```',
    '',
    '> **test-page** to agent at 17:23:38 (7ms)',
    '```JSON',
    '5',
    '```',
    '',
    'some separator',
    '',
    '> **agent** to test-page at 17:24:00',
    '```JS',
    '> **test-page** to agent at 17:23:38 (7ms)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Edge case: multiple response headers
test('parseRequest rejects fence starting with any response header pattern', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    '> **any-page** to another-agent at 00:00:00',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Valid code that happens to contain markdown-like text
test('parseRequest accepts code with markdown-like comments', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    '// This is a comment, not a markdown header',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.ok(result);
  assert.strictEqual(result.code, '// This is a comment, not a markdown header\nconst x = 1;');
});

test('parseRequest rejects code starting with exact response header pattern', () => {
  const input = [
    '> Append your JavaScript snippet below below',
    '```js',
    '> **page-name** to agent-name',
    'more code',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

// Complete scenario tests
test('parseRequest handles complete session with footer', () => {
  const input = [
    '> **agent** to test-page at 10:00:00',
    '```JS',
    '1+1',
    '```',
    '',
    '> **test-page** to agent at 10:00:01 (5ms)',
    '```JSON',
    '2',
    '```',
    '',
    '----------------------------------------------------------------------',
    '> Append your JavaScript snippet below below',
    '> **bob** to test-page at 10:01:00',
    '```javascript',
    'Math.sqrt(16)',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.deepStrictEqual(result, {
    agent: 'bob',
    target: 'test-page',
    time: '10:01:00',
    code: 'Math.sqrt(16)',
    hasFooter: true
  });
});

test('parseRequest handles complete session without footer after response deletion', () => {
  const input = [
    '> **agent** to test-page at 10:00:00',
    '```JS',
    '1+1',
    '```',
    '',
    '> **test-page** to agent at 10:00:01 (5ms)',
    '```JSON',
    '2',
    '```',
    '',
    'separator text',
    '',
    '> **agent** to test-page at 10:01:00',
    '```JS',
    '3+3',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.deepStrictEqual(result, {
    agent: 'agent',
    target: 'test-page',
    time: '',
    code: '3+3',
    hasFooter: false
  });
});
