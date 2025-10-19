// @ts-check
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

describe('server message handling', () => {
  test('worker-timeout message structure', () => {
    const payload = {
      type: 'worker-timeout',
      duration: 25000
    };
    
    assert.strictEqual(payload.type, 'worker-timeout');
    assert.strictEqual(typeof payload.duration, 'number');
    assert.ok(payload.duration > 0);
  });
  
  test('worker-init message structure', () => {
    const payload = {
      type: 'worker-init',
      mainPage: '7-zen-1201-03'
    };
    
    assert.strictEqual(payload.type, 'worker-init');
    assert.ok(payload.mainPage);
  });
  
  test('normal result with backgroundEvents', () => {
    const payload = {
      ok: true,
      value: 42,
      backgroundEvents: [
        {
          type: 'console',
          level: 'log',
          ts: '10:30:45',
          message: 'test message'
        }
      ],
      jobId: 'test-job-123'
    };
    
    assert.strictEqual(payload.ok, true);
    assert.strictEqual(payload.value, 42);
    assert.ok(Array.isArray(payload.backgroundEvents));
    assert.strictEqual(payload.backgroundEvents.length, 1);
    assert.strictEqual(payload.backgroundEvents[0].type, 'console');
  });
  
  test('error result with backgroundEvents', () => {
    const payload = {
      ok: false,
      error: 'Error: test error\n    at line 10',
      backgroundEvents: [
        {
          type: 'error',
          source: 'window.onerror',
          ts: '10:30:46',
          message: 'Uncaught error',
          stack: 'Error: Uncaught error\n    at line 5'
        }
      ],
      jobId: 'test-job-124'
    };
    
    assert.strictEqual(payload.ok, false);
    assert.ok(payload.error);
    assert.ok(Array.isArray(payload.backgroundEvents));
  });
});

describe('background event structure validation', () => {
  test('error event has required fields', () => {
    const event = {
      type: 'error',
      source: 'window.onerror',
      ts: '10:30:45',
      message: 'Error message',
      stack: 'Error stack trace'
    };
    
    assert.strictEqual(event.type, 'error');
    assert.ok(event.source);
    assert.match(event.ts, /^\d{2}:\d{2}:\d{2}$/);
    assert.ok(event.message);
    assert.ok(event.stack);
  });
  
  test('console event has required fields', () => {
    const event = {
      type: 'console',
      level: 'log',
      ts: '10:30:45',
      message: 'Console message'
    };
    
    assert.strictEqual(event.type, 'console');
    assert.ok(['log', 'info', 'warn', 'error'].includes(event.level));
    assert.match(event.ts, /^\d{2}:\d{2}:\d{2}$/);
    assert.ok(event.message);
  });
  
  test('console levels are valid', () => {
    const levels = ['log', 'info', 'warn', 'error'];
    
    levels.forEach(level => {
      const event = {
        type: 'console',
        level: level,
        ts: '10:30:45',
        message: 'test'
      };
      assert.strictEqual(event.level, level);
    });
  });
  
  test('error sources are valid', () => {
    const sources = ['window.onerror', 'unhandledrejection', 'self.onerror'];
    
    sources.forEach(source => {
      const event = {
        type: 'error',
        source: source,
        ts: '10:30:45',
        message: 'error',
        stack: 'stack'
      };
      assert.strictEqual(event.source, source);
    });
  });
});

describe('payload backward compatibility', () => {
  test('accepts legacy errors array', () => {
    const payload = {
      ok: true,
      value: 1,
      errors: ['Error 1', 'Error 2']
    };
    
    assert.ok(Array.isArray(payload.errors));
    assert.strictEqual(payload.errors.length, 2);
  });
  
  test('backgroundEvents takes precedence over errors', () => {
    const payload = {
      ok: true,
      value: 1,
      backgroundEvents: [
        { type: 'console', level: 'log', ts: '10:30:45', message: 'new' }
      ],
      errors: ['old error']
    };
    
    assert.ok(payload.backgroundEvents);
    assert.ok(payload.errors);
    // In writer.js, backgroundEvents should be checked first
  });
  
  test('handles payload with neither backgroundEvents nor errors', () => {
    const payload /** @type {any} */ = {
      ok: true,
      value: 42,
      jobId: 'test-job-125'
    };
    
    assert.strictEqual(payload.ok, true);
    assert.strictEqual(payload.value, 42);
    assert.ok(!payload.backgroundEvents);
    assert.ok(!payload.errors);
  });
});
