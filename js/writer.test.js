// @ts-check
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { clockFmt, durationFmt, findFooter, findLastFencedBlock, findAgentHeaderAbove, buildBlocks, formatBackgroundEvent, writeDiagnostic } from './writer.js';

// clockFmt tests
test('clockFmt pads single digit hours', () => {
  const ms = new Date('2025-01-01T03:45:12').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '03:45:12');
});

test('clockFmt pads single digit minutes', () => {
  const ms = new Date('2025-01-01T10:04:56').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '10:04:56');
});

test('clockFmt pads single digit seconds', () => {
  const ms = new Date('2025-01-01T15:30:05').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '15:30:05');
});

test('clockFmt handles double digit values', () => {
  const ms = new Date('2025-01-01T23:59:58').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '23:59:58');
});

// durationFmt tests
test('durationFmt returns ms for values under 2000', () => {
  assert.strictEqual(durationFmt(500), '500ms');
});

test('durationFmt returns ms for 1999', () => {
  assert.strictEqual(durationFmt(1999), '1999ms');
});

test('durationFmt returns seconds for 2000', () => {
  assert.strictEqual(durationFmt(2000), '2.0s');
});

test('durationFmt returns seconds for values 2000 and above', () => {
  assert.strictEqual(durationFmt(2500), '2.5s');
});

test('durationFmt formats seconds with one decimal', () => {
  assert.strictEqual(durationFmt(3750), '3.8s');
});

test('durationFmt returns ms for 0', () => {
  assert.strictEqual(durationFmt(0), '0ms');
});

// findFooter tests
test('findFooter returns index of footer line', () => {
  const lines = ['line1', 'line2', '> Write code in a fenced JS block below', 'line4'];
  const result = findFooter(lines);
  assert.strictEqual(result, 2);
});

test('findFooter returns -1 when footer not found', () => {
  const lines = ['line1', 'line2'];
  const result = findFooter(lines);
  assert.strictEqual(result, -1);
});

test('findFooter finds footer from bottom', () => {
  const lines = [
    '> Write code in a fenced JS block below',
    'middle',
    '> Write code in a fenced JS block below'
  ];
  const result = findFooter(lines);
  assert.strictEqual(result, 2);
});

test('findFooter returns -1 for empty array', () => {
  const lines = /** @type {string[]} */ ([]);
  const result = findFooter(lines);
  assert.strictEqual(result, -1);
});

test('findFooter handles partial match', () => {
  const lines = ['> Write code in', 'other'];
  const result = findFooter(lines);
  assert.strictEqual(result, -1);
});

// findLastFencedBlock tests
test('findLastFencedBlock finds simple JS fence', () => {
  const lines = ['```js', 'code', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

test('findLastFencedBlock finds javascript fence', () => {
  const lines = ['```javascript', 'code', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

test('findLastFencedBlock finds fence without language tag', () => {
  const lines = ['```', 'code', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

test('findLastFencedBlock returns last fence when multiple exist', () => {
  const lines = ['```js', 'first', '```', 'text', '```js', 'second', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 4, end: 6 });
});

test('findLastFencedBlock returns null when no fence found', () => {
  const lines = ['just', 'text'];
  const result = findLastFencedBlock(lines);
  assert.strictEqual(result, null);
});

test('findLastFencedBlock returns null when only opening fence', () => {
  const lines = ['```js', 'code'];
  const result = findLastFencedBlock(lines);
  assert.strictEqual(result, null);
});

test('findLastFencedBlock returns null when only closing fence', () => {
  const lines = ['code', '```'];
  const result = findLastFencedBlock(lines);
  assert.strictEqual(result, null);
});

test('findLastFencedBlock handles trimmed fence markers', () => {
  const lines = ['  ```js  ', 'code', '  ```  '];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

// findAgentHeaderAbove tests
test('findAgentHeaderAbove finds header directly above', () => {
  const lines = ['> **agent** to page', 'next'];
  const result = findAgentHeaderAbove(lines, 1);
  assert.strictEqual(result, 0);
});

test('findAgentHeaderAbove skips blank lines', () => {
  const lines = ['> **agent** to page', '', '', 'target'];
  const result = findAgentHeaderAbove(lines, 3);
  assert.strictEqual(result, 0);
});

test('findAgentHeaderAbove returns -1 when no header found', () => {
  const lines = ['just text', 'target'];
  const result = findAgentHeaderAbove(lines, 1);
  assert.strictEqual(result, -1);
});

test('findAgentHeaderAbove returns -1 at start of file', () => {
  const lines = ['first'];
  const result = findAgentHeaderAbove(lines, 0);
  assert.strictEqual(result, -1);
});

test('findAgentHeaderAbove handles whitespace-only lines', () => {
  const lines = ['> **agent** to page', '  \t  ', 'target'];
  const result = findAgentHeaderAbove(lines, 2);
  assert.strictEqual(result, 0);
});

// buildBlocks tests
test('buildBlocks creates JSON block for successful primitive result', () => {
  const result = { ok: true, value: 42 };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0], '```JSON\n42\n```');
});

test('buildBlocks creates JSON block for successful object result', () => {
  const result = { ok: true, value: { x: 1, y: 2 } };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
  assert.match(blocks[0], /```JSON\n/);
  assert.match(blocks[0], /"x": 1/);
});

test('buildBlocks creates Error block for failed result', () => {
  const result = { ok: false, error: 'Test error message' };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0], '```Error\nTest error message\n```');
});

test('buildBlocks includes background errors when present', () => {
  const result = { ok: true, value: 1, errors: ['Error 1', 'Error 2'] };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 3);
  assert.match(blocks[1], /Error 1/);
  assert.match(blocks[2], /Error 2/);
});

test('buildBlocks truncates background errors when more than 10', () => {
  const errors = Array.from({ length: 15 }, (_, i) => `Error ${i}`);
  const result = { ok: true, value: 1, errors };
  const blocks = buildBlocks(result);
  assert.ok(blocks.some(b => b.includes('more background events omitted')));
});

test('buildBlocks handles empty errors array', () => {
  const result = { ok: true, value: 1, errors: [] };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
});

test('buildBlocks handles null value', () => {
  const result = { ok: true, value: null };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks[0], '```JSON\nnull\n```');
});

test('buildBlocks handles undefined value', () => {
  const result = { ok: true, value: undefined };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks[0], '```JSON\nundefined\n```');
});

test('buildBlocks handles string value', () => {
  const result = { ok: true, value: 'hello' };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks[0], '```JSON\nhello\n```');
});

// formatBackgroundEvent tests
test('formatBackgroundEvent formats error with window.onerror source', () => {
  const event = {
    type: 'error',
    source: 'window.onerror',
    ts: '10:30:45',
    message: 'Uncaught Error',
    stack: 'Error: Uncaught Error\n    at line 10'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```window.onerror\nError: Uncaught Error\n    at line 10\n```');
});

test('formatBackgroundEvent formats error with unhandledrejection source', () => {
  const event = {
    type: 'error',
    source: 'unhandledrejection',
    ts: '10:30:45',
    message: 'Promise rejected',
    stack: 'Error: Promise rejected\n    at async line 20'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```unhandledrejection\nError: Promise rejected\n    at async line 20\n```');
});

test('formatBackgroundEvent formats error without stack', () => {
  const event = {
    type: 'error',
    source: 'window.onerror',
    ts: '10:30:45',
    message: 'Simple error',
    stack: ''
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```window.onerror\nSimple error\n```');
});

test('formatBackgroundEvent formats error without source', () => {
  const event = {
    type: 'error',
    ts: '10:30:45',
    message: 'Generic error',
    stack: 'Error: Generic error'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```Error\nError: Generic error\n```');
});

test('formatBackgroundEvent formats console.log with JSON content', () => {
  const event = {
    type: 'console',
    level: 'log',
    ts: '10:30:45',
    message: '{"x":1,"y":2}'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```JSON console.log\n{"x":1,"y":2}\n```');
});

test('formatBackgroundEvent formats console.log with text content', () => {
  const event = {
    type: 'console',
    level: 'log',
    ts: '10:30:45',
    message: 'Hello world'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```Text console.log\nHello world\n```');
});

test('formatBackgroundEvent formats console.info', () => {
  const event = {
    type: 'console',
    level: 'info',
    ts: '10:30:45',
    message: 'Information message'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```Text console.info\nInformation message\n```');
});

test('formatBackgroundEvent formats console.warn', () => {
  const event = {
    type: 'console',
    level: 'warn',
    ts: '10:30:45',
    message: 'Warning message'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```Text console.warn\nWarning message\n```');
});

test('formatBackgroundEvent formats console.error', () => {
  const event = {
    type: 'console',
    level: 'error',
    ts: '10:30:45',
    message: 'Error message'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```Error console.error\nError message\n```');
});

test('formatBackgroundEvent formats console without level', () => {
  const event = {
    type: 'console',
    ts: '10:30:45',
    message: 'Default message'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```Text console.log\nDefault message\n```');
});

test('formatBackgroundEvent handles unknown event type', () => {
  const event = {
    type: 'unknown',
    ts: '10:30:45',
    message: 'Strange event'
  };
  const result = formatBackgroundEvent(event);
  assert.strictEqual(result, '```Text\nStrange event\n```');
});

// buildBlocks with backgroundEvents tests
test('buildBlocks with backgroundEvents array', () => {
  const result = {
    ok: true,
    value: 42,
    backgroundEvents: [
      { type: 'console', level: 'log', ts: '10:30:45', message: 'test' }
    ]
  };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0], '```JSON\n42\n```');
  assert.match(blocks[1], /console\.log/);
});

test('buildBlocks with multiple backgroundEvents', () => {
  const result = {
    ok: true,
    value: 'ok',
    backgroundEvents: [
      { type: 'console', level: 'log', ts: '10:30:45', message: 'first' },
      { type: 'error', source: 'window.onerror', ts: '10:30:46', message: 'error', stack: 'Error: error' },
      { type: 'console', level: 'warn', ts: '10:30:47', message: 'warning' }
    ]
  };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 4);
  assert.match(blocks[1], /console\.log/);
  assert.match(blocks[2], /window\.onerror/);
  assert.match(blocks[3], /console\.warn/);
});

test('buildBlocks truncates backgroundEvents when more than 10', () => {
  const events = Array.from({ length: 15 }, (_, i) => ({
    type: 'console',
    level: 'log',
    ts: '10:30:45',
    message: `Message ${i}`
  }));
  const result = { ok: true, value: 1, backgroundEvents: events };
  const blocks = buildBlocks(result);
  
  // Should have: 1 result + 2 first events + 1 ellipsis + 8 last events = 12 blocks
  assert.strictEqual(blocks.length, 12);
  assert.match(blocks[1], /Message 0/);
  assert.match(blocks[2], /Message 1/);
  assert.match(blocks[3], /5 more background events omitted/);
  assert.match(blocks[4], /Message 7/);
  assert.match(blocks[11], /Message 14/);
});

test('buildBlocks with empty backgroundEvents array', () => {
  const result = { ok: true, value: 1, backgroundEvents: [] };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
});

test('buildBlocks prefers backgroundEvents over legacy errors', () => {
  const result = {
    ok: true,
    value: 1,
    backgroundEvents: [
      { type: 'console', level: 'log', ts: '10:30:45', message: 'new format' }
    ],
    errors: ['old format error']
  };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 2);
  assert.match(blocks[1], /new format/);
  assert.ok(!blocks.some(b => b.includes('old format')));
});

// writeDiagnostic tests
describe('writeDiagnostic', () => {
  const testFile = join(process.cwd(), 'test-diagnostic-temp.md');
  
  test('creates file with diagnostic when file does not exist', () => {
    if (existsSync(testFile)) unlinkSync(testFile);
    
    writeDiagnostic(testFile, 'Test diagnostic message');
    
    assert.ok(existsSync(testFile));
    const content = readFileSync(testFile, 'utf8');
    assert.match(content, /# Worker Diagnostics/);
    assert.match(content, /Test diagnostic message/);
    assert.match(content, /Write code in a fenced JS block/);
    
    unlinkSync(testFile);
  });
  
  test('appends diagnostic to existing file', () => {
    const initial = [
      '# Test File',
      '',
      '> **page** to agent at 10:00:00',
      '```JSON',
      '42',
      '```',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      '',
      ''
    ].join('\n');
    
    writeFileSync(testFile, initial, 'utf8');
    writeDiagnostic(testFile, 'Worker timeout detected');
    
    const content = readFileSync(testFile, 'utf8');
    assert.match(content, /Worker timeout detected/);
    assert.match(content, /System.*at \d{2}:\d{2}:\d{2}/);
    
    unlinkSync(testFile);
  });
  
  test('inserts diagnostic above footer', () => {
    const initial = [
      '# Test File',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      '',
      ''
    ].join('\n');
    
    writeFileSync(testFile, initial, 'utf8');
    writeDiagnostic(testFile, 'Restart attempt 3');
    
    const content = readFileSync(testFile, 'utf8');
    const lines = content.split('\n');
    const footerIdx = lines.findIndex(l => l.includes('Write code in a fenced'));
    const diagnosticIdx = lines.findIndex(l => l.includes('Restart attempt 3'));
    
    assert.ok(diagnosticIdx >= 0);
    assert.ok(footerIdx >= 0);
    assert.ok(diagnosticIdx < footerIdx, 'Diagnostic should be above footer');
    
    unlinkSync(testFile);
  });
});

describe('writeReply exports', () => {
  test('writeReply is exported', async () => {
    const writer = await import('./writer.js');
    assert.equal(typeof writer.writeReply, 'function');
  });

  test('writeExecuting is exported', async () => {
    const writer = await import('./writer.js');
    assert.equal(typeof writer.writeExecuting, 'function');
  });
});

describe('writer edge cases', () => {
  test('clockFmt handles midnight', () => {
    const midnight = new Date('2024-01-01T00:00:00');
    const result = clockFmt(midnight.getTime());
    assert.equal(result, '00:00:00');
  });

  test('clockFmt handles noon', () => {
    const noon = new Date('2024-01-01T12:00:00');
    const result = clockFmt(noon.getTime());
    assert.equal(result, '12:00:00');
  });

  test('clockFmt handles 23:59:59', () => {
    const almostMidnight = new Date('2024-01-01T23:59:59');
    const result = clockFmt(almostMidnight.getTime());
    assert.equal(result, '23:59:59');
  });

  test('durationFmt handles negative values gracefully', () => {
    const result = durationFmt(-100);
    assert.ok(result.includes('-') || result.includes('100'));
  });

  test('findFooter handles lines with footer substring', () => {
    const lines = [
      'This line mentions: Write code in a fenced JS block',
      'But this is the real footer:',
      '> Write code in a fenced JS block below to execute against this page.'
    ];
    const idx = findFooter(lines);
    assert.equal(idx, 2);
  });

  test('findLastFencedBlock handles nested fences in comment', () => {
    const lines = [
      '// Example: ```js',
      '```js',
      'const x = 1;',
      '```'
    ];
    const result = findLastFencedBlock(lines);
    assert.deepEqual(result, { start: 1, end: 3 });
  });

  test('findAgentHeaderAbove handles multiple blank lines', () => {
    const lines = [
      '> **agent** to page',
      '',
      '',
      '',
      '```js',
      'code',
      '```'
    ];
    const idx = findAgentHeaderAbove(lines, 4);
    assert.equal(idx, 0);
  });

  test('buildBlocks handles boolean false value', () => {
    const result = { ok: true, value: false };
    const blocks = buildBlocks(result);
    assert.equal(blocks.length, 1);
    assert.ok(blocks[0].includes('false'));
  });

  test('buildBlocks handles number zero value', () => {
    const result = { ok: true, value: 0 };
    const blocks = buildBlocks(result);
    assert.equal(blocks.length, 1);
    assert.ok(blocks[0].includes('0'));
  });

  test('buildBlocks handles empty string value', () => {
    const result = { ok: true, value: '' };
    const blocks = buildBlocks(result);
    assert.equal(blocks.length, 1);
    assert.ok(blocks[0].includes('JSON'));
  });

  test('formatBackgroundEvent handles error with very long stack', () => {
    const event = {
      type: 'error',
      source: 'window.onerror',
      ts: '12:00:00',
      message: 'Error',
      stack: 'a'.repeat(10000)
    };
    const result = formatBackgroundEvent(event);
    assert.ok(result.includes('```'));
    assert.ok(result.length > 100);
  });

  test('formatBackgroundEvent handles console with multiline message', () => {
    const event = {
      type: 'console',
      level: 'log',
      ts: '12:00:00',
      message: 'Line 1\nLine 2\nLine 3'
    };
    const result = formatBackgroundEvent(event);
    assert.ok(result.includes('Line 1'));
    assert.ok(result.includes('Line 2'));
  });
});
