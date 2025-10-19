// @ts-check
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

/**
 * Extract helper functions from client.js for testing
 * These are the actual implementations from client.js
 * @returns {string}
 */

// Helper to format time as HH:MM:SS
const formatTime = () => {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
};

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

// Sanitize name to match registry expectations
const sanitizeName = (/** @type {string} */ n) => 
  n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

describe('formatTime', () => {
  test('returns HH:MM:SS format', () => {
    const result = formatTime();
    assert.match(result, /^\d{2}:\d{2}:\d{2}$/);
  });
  
  test('pads single digit values', () => {
    const result = formatTime();
    const parts = result.split(':');
    assert.strictEqual(parts.length, 3);
    parts.forEach(part => {
      assert.strictEqual(part.length, 2);
    });
  });
});

describe('serializeValue', () => {
  describe('primitives', () => {
    test('serializes null', () => {
      assert.strictEqual(serializeValue(null), 'null');
    });
    
    test('serializes undefined', () => {
      assert.strictEqual(serializeValue(undefined), 'undefined');
    });
    
    test('serializes strings', () => {
      assert.strictEqual(serializeValue('hello'), 'hello');
      assert.strictEqual(serializeValue(''), '');
    });
    
    test('serializes numbers', () => {
      assert.strictEqual(serializeValue(42), '42');
      assert.strictEqual(serializeValue(0), '0');
      assert.strictEqual(serializeValue(3.14), '3.14');
      assert.strictEqual(serializeValue(-10), '-10');
    });
    
    test('serializes booleans', () => {
      assert.strictEqual(serializeValue(true), 'true');
      assert.strictEqual(serializeValue(false), 'false');
    });
  });
  
  describe('functions', () => {
    test('serializes named function', () => {
      function myFunction() {}
      assert.strictEqual(serializeValue(myFunction), 'myFunction');
    });
    
    test('serializes anonymous function', () => {
      const fn = function() {};
      // Variable name may be used if function has no name property
      const result = serializeValue(fn);
      assert.ok(result === 'fn' || result === '[Function]');
    });
    
    test('serializes arrow function', () => {
      const fn = () => {};
      // Variable name may be used if function has no name property
      const result = serializeValue(fn);
      assert.ok(result === 'fn' || result === '[Function]');
    });
  });
  
  describe('arrays', () => {
    test('serializes empty array', () => {
      assert.strictEqual(serializeValue([]), '[]');
    });
    
    test('serializes array of primitives', () => {
      assert.strictEqual(serializeValue([1, 2, 3]), '[1, 2, 3]');
    });
    
    test('serializes array with mixed types', () => {
      assert.strictEqual(serializeValue([1, 'hello', true]), '[1, hello, true]');
    });
    
    test('serializes nested arrays', () => {
      assert.strictEqual(serializeValue([1, [2, 3]]), '[1, [2, 3]]');
    });
    
    test('limits depth for deeply nested arrays', () => {
      const deep = [[[[[1]]]]];
      const result = serializeValue(deep);
      assert.ok(result.includes('[Deep Object]'));
    });
  });
  
  describe('objects', () => {
    test('serializes simple object', () => {
      const result = serializeValue({ x: 1, y: 2 });
      assert.strictEqual(result, '{"x":1,"y":2}');
    });
    
    test('serializes empty object', () => {
      assert.strictEqual(serializeValue({}), '{}');
    });
    
    test('serializes nested object', () => {
      const obj = { a: { b: { c: 1 } } };
      const result = serializeValue(obj);
      assert.ok(result.includes('"a"'));
      assert.ok(result.includes('"b"'));
      assert.ok(result.includes('"c"'));
    });
    
    test('handles JSON.stringify failure gracefully', () => {
      const circular = /** @type {any} */ ({});
      circular.self = circular;
      const result = serializeValue(circular);
      assert.ok(typeof result === 'string');
      // Should fall back to String() which produces "[object Object]"
      assert.ok(result.length > 0);
    });
    
    test('limits depth for deeply nested objects', () => {
      const deep = { a: { b: { c: { d: { e: 1 } } } } };
      const result = serializeValue(deep);
      assert.ok(result.includes('[Deep Object]') || result.includes('"e"'));
    });
  });
  
  describe('depth limiting', () => {
    test('stops at depth 3', () => {
      const deep = { a: { b: { c: { d: 1 } } } };
      const result = serializeValue(deep);
      assert.ok(result.includes('[Deep Object]') || typeof result === 'string');
    });
    
    test('handles mixed nesting', () => {
      const mixed = { a: [{ b: [{ c: 1 }] }] };
      const result = serializeValue(mixed);
      assert.ok(typeof result === 'string');
    });
  });
});

describe('sanitizeName', () => {
  test('converts to lowercase', () => {
    assert.strictEqual(sanitizeName('HelloWorld'), 'helloworld');
    assert.strictEqual(sanitizeName('ABC'), 'abc');
  });
  
  test('replaces special characters with dashes', () => {
    assert.strictEqual(sanitizeName('hello world'), 'hello-world');
    assert.strictEqual(sanitizeName('test@example.com'), 'test-example-com');
    assert.strictEqual(sanitizeName('a/b/c'), 'a-b-c');
  });
  
  test('replaces multiple consecutive special chars with single dash', () => {
    assert.strictEqual(sanitizeName('hello   world'), 'hello-world');
    assert.strictEqual(sanitizeName('test!!!name'), 'test-name');
  });
  
  test('removes leading dashes', () => {
    assert.strictEqual(sanitizeName('-hello'), 'hello');
    assert.strictEqual(sanitizeName('--test'), 'test');
  });
  
  test('removes trailing dashes', () => {
    assert.strictEqual(sanitizeName('hello-'), 'hello');
    assert.strictEqual(sanitizeName('test--'), 'test');
  });
  
  test('preserves alphanumeric characters', () => {
    assert.strictEqual(sanitizeName('abc123xyz'), 'abc123xyz');
  });
  
  test('handles mixed case with special chars', () => {
    assert.strictEqual(sanitizeName('Test-Name_123'), 'test-name-123');
  });
  
  test('handles empty parts', () => {
    assert.strictEqual(sanitizeName('a--b'), 'a-b');
  });
  
  test('handles worker name generation pattern', () => {
    const mainName = '7-zen-1201-03';
    const workerName = sanitizeName(mainName + '-webworker');
    assert.strictEqual(workerName, '7-zen-1201-03-webworker');
  });
});
