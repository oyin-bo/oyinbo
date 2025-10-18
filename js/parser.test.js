// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest } from './parser.js';

test('parseRequest extracts code from footer-based request with agent header', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '> **agent** to test-page at 12:34:56',
    '```js',
    'console.log("hello")',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'console.log("hello")\n');
});

test('parseRequest extracts agent from header', () => {
  const input = [
    '> Write code in a fenced JS block below',
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
    '> Write code in a fenced JS block below',
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
    '> Write code in a fenced JS block below',
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
    '> Write code in a fenced JS block below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.hasFooter, true);
});

test('parseRequest returns complete object for footer-based request', () => {
  const input = [
    '> Write code in a fenced JS block below',
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
    code: '1 + 1\n',
    hasFooter: true
  });
});

test('parseRequest defaults agent to "agent" when header missing', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.agent, 'agent');
});

test('parseRequest defaults target to pageName when header missing', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'my-test-page');
  
  assert.strictEqual(result.target, 'my-test-page');
});

test('parseRequest defaults time to empty string when header missing', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```js',
    'x',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.time, '');
});

test('parseRequest returns null when chunk after footer is empty', () => {
  const input = '> Write code in a fenced JS block below\n   \n';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when chunk after footer is whitespace only', () => {
  const input = '> Write code in a fenced JS block below\n\n  \t  \n';
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence is empty', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```js',
    '   ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest returns null when fence contains only whitespace', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```js',
    '  \n  \t  \n  ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result, null);
});

test('parseRequest accepts fence with "javascript" language tag', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```javascript',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'const x = 1;\n');
});

test('parseRequest accepts fence with no language tag', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```',
    'const x = 1;',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'const x = 1;\n');
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
  
  assert.strictEqual(result.code, 'second\n');
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
    '> Write code in a fenced JS block below',
    '```js',
    'function test() {',
    '  return 42;',
    '}',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, 'function test() {\n  return 42;\n}\n');
});

test('parseRequest preserves whitespace in code', () => {
  const input = [
    '> Write code in a fenced JS block below',
    '```js',
    '  indented  ',
    '```'
  ].join('\n');
  
  const result = parseRequest(input, 'test-page');
  
  assert.strictEqual(result.code, '  indented  \n');
});
