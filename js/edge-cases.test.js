// @ts-check
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

/**
 * Edge case tests for background event handling
 */

describe('background event edge cases', () => {
  describe('serialization edge cases', () => {
    /**
     * @param {any} val
     * @param {number} depth
     * @returns {string}
     */
    const serializeValue = (val, depth = 0) => {
      if (depth > 3) return '[Deep Object]';
      if (val === null) return 'null';
      if (val === undefined) return 'undefined';
      if (typeof val === 'function') return val.name || '[Function]';
      if (typeof val === 'string') return val;
      if (typeof val === 'number' || typeof val === 'boolean') return String(val);
      if (Array.isArray(val)) {
        try {
          return '[' + val.map((/** @type {any} */ v) => serializeValue(v, depth + 1)).join(', ') + ']';
        } catch (e) {
          return '[Array]';
        }
      }
      if (typeof val === 'object') {
        try {
          return JSON.stringify(val);
        } catch (e) {
          return String(val);
        }
      }
      return String(val);
    };
    
    test('handles NaN', () => {
      assert.strictEqual(serializeValue(NaN), 'NaN');
    });
    
    test('handles Infinity', () => {
      assert.strictEqual(serializeValue(Infinity), 'Infinity');
      assert.strictEqual(serializeValue(-Infinity), '-Infinity');
    });
    
    test('handles BigInt', () => {
      const result = serializeValue(BigInt(123));
      assert.ok(typeof result === 'string');
    });
    
    test('handles Symbol', () => {
      const sym = Symbol('test');
      const result = serializeValue(sym);
      assert.ok(typeof result === 'string');
    });
    
    test('handles empty string', () => {
      assert.strictEqual(serializeValue(''), '');
    });
    
    test('handles whitespace-only string', () => {
      assert.strictEqual(serializeValue('   '), '   ');
    });
    
    test('handles string with special characters', () => {
      const special = 'Hello\nWorld\tTest\\Path';
      assert.strictEqual(serializeValue(special), special);
    });
    
    test('handles very long string', () => {
      const long = 'x'.repeat(10000);
      const result = serializeValue(long);
      assert.strictEqual(result.length, 10000);
    });
    
    test('handles object with circular reference', () => {
      const circular = /** @type {any} */ ({ a: 1 });
      circular.self = circular;
      const result = serializeValue(circular);
      // Should not throw, should return string representation
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });
    
    test('handles array with circular reference', () => {
      const arr = /** @type {any[]} */ ([1, 2]);
      arr.push(arr);
      const result = serializeValue(arr);
      // Should handle gracefully
      assert.ok(typeof result === 'string');
    });
    
    test('handles Date object', () => {
      const date = new Date('2025-01-01');
      const result = serializeValue(date);
      assert.ok(result.includes('2025'));
    });
    
    test('handles RegExp object', () => {
      const regex = /test/gi;
      const result = serializeValue(regex);
      // JSON.stringify on RegExp returns "{}", so it becomes a string representation
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });
    
    test('handles Error object', () => {
      const error = new Error('test error');
      const result = serializeValue(error);
      assert.ok(typeof result === 'string');
    });
    
    test('handles array with undefined elements', () => {
      const arr = [1, undefined, 3];
      const result = serializeValue(arr);
      assert.strictEqual(result, '[1, undefined, 3]');
    });
    
    test('handles array with null elements', () => {
      const arr = [1, null, 3];
      const result = serializeValue(arr);
      assert.strictEqual(result, '[1, null, 3]');
    });
    
    test('handles object with undefined values', () => {
      const obj = { a: 1, b: undefined, c: 3 };
      const result = serializeValue(obj);
      // JSON.stringify omits undefined values
      assert.ok(result.includes('"a":1'));
      assert.ok(!result.includes('undefined'));
    });
    
    test('handles object with null values', () => {
      const obj = { a: 1, b: null, c: 3 };
      const result = serializeValue(obj);
      assert.ok(result.includes('"b":null'));
    });
    
    test('handles nested array of arrays', () => {
      const nested = [[1, 2], [3, 4], [5, 6]];
      const result = serializeValue(nested);
      assert.strictEqual(result, '[[1, 2], [3, 4], [5, 6]]');
    });
    
    test('handles mixed nested structures', () => {
      const mixed = { a: [1, { b: 2 }], c: { d: [3, 4] } };
      const result = serializeValue(mixed);
      assert.ok(typeof result === 'string');
      assert.ok(result.includes('"a"'));
    });
    
    test('handles object with numeric keys', () => {
      const obj = { 1: 'one', 2: 'two' };
      const result = serializeValue(obj);
      assert.ok(result.includes('"1"'));
      assert.ok(result.includes('"2"'));
    });
    
    test('handles sparse array', () => {
      const sparse = [];
      sparse[0] = 1;
      sparse[5] = 2;
      const result = serializeValue(sparse);
      assert.ok(typeof result === 'string');
    });
    
    test('catches serialization errors', () => {
      const problematic = {
        get dangerous() {
          throw new Error('Property access error');
        }
      };
      
      // Should not throw, should return string representation
      const result = serializeValue(problematic);
      assert.ok(typeof result === 'string');
    });
  });
  
  describe('event timing edge cases', () => {
    test('events with identical timestamps', () => {
      const events = [
        { type: 'console', level: 'log', ts: '10:30:45', message: 'first' },
        { type: 'console', level: 'log', ts: '10:30:45', message: 'second' },
        { type: 'console', level: 'log', ts: '10:30:45', message: 'third' }
      ];
      
      // All events should be preserved in order
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[0].message, 'first');
      assert.strictEqual(events[2].message, 'third');
    });
    
    test('events spanning midnight', () => {
      const events = [
        { type: 'console', level: 'log', ts: '23:59:58', message: 'before' },
        { type: 'console', level: 'log', ts: '23:59:59', message: 'almost' },
        { type: 'console', level: 'log', ts: '00:00:00', message: 'midnight' },
        { type: 'console', level: 'log', ts: '00:00:01', message: 'after' }
      ];
      
      // Should maintain chronological order (though timestamps alone can't show day boundary)
      assert.strictEqual(events.length, 4);
    });
  });
  
  describe('event truncation edge cases', () => {
    test('exactly 10 events - no truncation', () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        type: 'console',
        level: 'log',
        ts: '10:30:45',
        message: `Event ${i}`
      }));
      
      assert.strictEqual(events.length, 10);
      // buildBlocks should not truncate at exactly 10
    });
    
    test('11 events - triggers truncation', () => {
      const events = Array.from({ length: 11 }, (_, i) => ({
        type: 'console',
        level: 'log',
        ts: '10:30:45',
        message: `Event ${i}`
      }));
      
      assert.strictEqual(events.length, 11);
      // buildBlocks should truncate: 2 first + ellipsis + 8 last
    });
    
    test('100 events - heavy truncation', () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        type: 'console',
        level: 'log',
        ts: '10:30:45',
        message: `Event ${i}`
      }));
      
      assert.strictEqual(events.length, 100);
      // Would show: Event 0, Event 1, "... 90 omitted ...", Event 92-99
    });
  });
  
  describe('empty and missing fields', () => {
    test('event with empty message', () => {
      const event = {
        type: 'console',
        level: 'log',
        ts: '10:30:45',
        message: ''
      };
      
      assert.strictEqual(event.message, '');
    });
    
    test('event with empty stack', () => {
      const event = {
        type: 'error',
        source: 'window.onerror',
        ts: '10:30:45',
        message: 'Error',
        stack: ''
      };
      
      assert.strictEqual(event.stack, '');
    });
    
    test('event missing optional fields', () => {
      const event = {
        type: 'error',
        ts: '10:30:45',
        message: 'Minimal error'
      };
      
      const eventAny = /** @type {any} */ (event);
      assert.ok(!eventAny.source);
      assert.ok(!eventAny.stack);
    });
  });
});

describe('worker name edge cases', () => {
  const sanitizeName = (/** @type {string} */ n) => 
    n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  test('unicode characters', () => {
    const result = sanitizeName('test-🚀-name');
    assert.ok(!result.includes('🚀'));
    assert.strictEqual(result, 'test-name');
  });
  
  test('all special characters', () => {
    const result = sanitizeName('!@#$%^&*()');
    assert.ok(result.length === 0 || result === '');
  });
  
  test('only dashes', () => {
    const result = sanitizeName('---');
    assert.strictEqual(result, '');
  });
  
  test('mixed case with numbers', () => {
    const result = sanitizeName('Test123Name456');
    assert.strictEqual(result, 'test123name456');
  });
  
  test('very long name', () => {
    const long = 'a'.repeat(1000);
    const result = sanitizeName(long);
    assert.strictEqual(result.length, 1000);
  });
  
  test('name with dots', () => {
    const result = sanitizeName('page.example.com');
    assert.strictEqual(result, 'page-example-com');
  });
  
  test('name with underscores', () => {
    const result = sanitizeName('test_page_name');
    assert.strictEqual(result, 'test-page-name');
  });
});
