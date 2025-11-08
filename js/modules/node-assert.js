// @ts-check

function nodeAssertBody() {
  /**
   * AssertionError - matches Node.js assert module
   */
  class AssertionError extends Error {
    constructor(/** @type {any} */ message, /** @type {any} */ actual, /** @type {any} */ expected) {
      super(message);
      this.name = 'AssertionError';
      this.actual = actual;
      this.expected = expected;
    }
  }

    function ok(/** @type {any} */ value, /** @type {any} */ message) {
      if (!value) throw new AssertionError(message || 'Expected truthy value', value, true);
    }
    function equal(/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) {
      if (actual != expected) throw new AssertionError(message || 'Values not equal', actual, expected);
    }
    function strictEqual(/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) {
      if (actual !== expected) throw new AssertionError(message || 'Values not strictly equal', actual, expected);
    }
    function notEqual(/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) {
      if (actual == expected) throw new AssertionError(message || 'Values should not be equal', actual, expected);
    }
    function notStrictEqual(/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) {
      if (actual === expected) throw new AssertionError(message || 'Values should not be strictly equal', actual, expected);
    }
    function deepEqual(/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) {
      if (!deepEqualImpl(actual, expected)) {
        throw new AssertionError(message || 'Objects not deeply equal', actual, expected);
      }
    }
    function deepStrictEqual(/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) {
      if (!deepStrictEqualImpl(actual, expected)) {
        throw new AssertionError(message || 'Objects not deeply equal', actual, expected);
      }
    }
    function match(/** @type {any} */ string, /** @type {RegExp} */ regexp, /** @type {any} */ message) {
      if (!regexp.test(String(string))) {
        throw new AssertionError(
          message || `String does not match pattern ${regexp}`,
          string,
          regexp
        );
      }
    }
    function doesNotMatch(/** @type {any} */ string, /** @type {RegExp} */ regexp, /** @type {any} */ message) {
      if (regexp.test(String(string))) {
        throw new AssertionError(
          message || `String matches pattern ${regexp}`,
          string,
          regexp
        );
      }
    }
    function throws(/** @type {any} */ fn, /** @type {any} */ errorValidator, /** @type {any} */ message) {
      let threw = false;
      let caughtError = null;
      try { fn(); } catch (e) { threw = true; caughtError = e; }
      if (!threw) throw new AssertionError(message || 'Function did not throw', null, 'error');

      // Validate error if validator provided
      if (errorValidator) {
        const _caught = /** @type {any} */ (caughtError);
        if (typeof errorValidator === 'function') {
          // Constructor check
          if (!(_caught instanceof errorValidator)) {
            throw new AssertionError(
              message || `Expected error to be instance of ${errorValidator.name}`,
              caughtError,
              errorValidator
            );
          }
        } else if (errorValidator instanceof RegExp) {
          // Regex check on message
          if (!errorValidator.test(_caught?.message || String(_caught))) {
            throw new AssertionError(
              message || `Expected error message to match ${errorValidator}`,
              _caught?.message,
              errorValidator
            );
          }
        }
      }
    }
    function doesNotThrow(/** @type {any} */ fn, /** @type {any} */ message) {
      try {
        fn();
      } catch (e) {
        throw new AssertionError(
          message || `Function threw unexpectedly: ${e}`,
          e,
          null
        );
      }
    }
    async function rejects(/** @type {any} */ fn, /** @type {any} */ errorValidator, /** @type {any} */ message) {
      let rejected = false;
      let caughtError = null;
      try { await fn(); } catch (e) { rejected = true; caughtError = e; }
      if (!rejected) throw new AssertionError(message || 'Promise did not reject', null, 'rejection');

      // Validate error if validator provided
      if (errorValidator) {
        const _caught = /** @type {any} */ (caughtError);
        if (typeof errorValidator === 'function') {
          // Constructor check
          if (!(_caught instanceof errorValidator)) {
            throw new AssertionError(
              message || `Expected rejection to be instance of ${errorValidator.name}`,
              caughtError,
              errorValidator
            );
          }
        } else if (errorValidator instanceof RegExp) {
          // Regex check on message
          if (!errorValidator.test(_caught?.message || String(_caught))) {
            throw new AssertionError(
              message || `Expected rejection message to match ${errorValidator}`,
              _caught?.message,
              errorValidator
            );
          }
        }
      }
    }
    async function doesNotReject(/** @type {any} */ fn, /** @type {any} */ message) {
      try {
        await fn();
      } catch (e) {
        throw new AssertionError(
          message || `Promise rejected unexpectedly: ${e}`,
          e,
          null
        );
      }
    }
    function fail(/** @type {any} */ message) {
      throw new AssertionError(message || 'Explicit fail', undefined, undefined);
    }

  /**
   * Deep equality check implementation
   * @param {any} a
   * @param {any} b
   * @returns {boolean}
   */
  function deepEqualImpl(a, b) {
    // Strict equality check
    if (a === b) return true;

    // Handle null/undefined
    if (a == null || b == null) return a === b;

    // Type check
    if (typeof a !== typeof b) return false;

    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Handle regex
    if (a instanceof RegExp && b instanceof RegExp) {
      return a.source === b.source && a.flags === b.flags;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqualImpl(a[i], b[i])) return false;
      }
      return true;
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqualImpl(a[key], b[key])) return false;
      }
      return true;
    }

    // Primitives that didn't match in strict equality
    return false;
  }

  /**
   * Deep strict equality check implementation
   * Uses strict (===) equality for primitives
   * @param {any} a
   * @param {any} b
   * @returns {boolean}
   */
  function deepStrictEqualImpl(a, b) {
    // Strict equality check
    if (a === b) return true;

    // Handle null/undefined with strict equality
    if (a == null || b == null) return a === b;

    // Type check - strict comparison requires same type
    if (typeof a !== typeof b) return false;

    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Handle regex
    if (a instanceof RegExp && b instanceof RegExp) {
      return a.source === b.source && a.flags === b.flags;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepStrictEqualImpl(a[i], b[i])) return false;
      }
      return true;
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepStrictEqualImpl(a[key], b[key])) return false;
      }
      return true;
    }

    // Primitives that didn't match in strict equality
    return false;
  }

  const assertExports = {
    AssertionError,
    ok,
    equal,
    strictEqual,
    notEqual,
    notStrictEqual,
    deepEqual,
    deepStrictEqual,
    match,
    doesNotMatch,
    throws,
    doesNotThrow,
    rejects,
    doesNotReject,
    fail
  };

  /** @type {typeof ok & typeof assertExports & { strict: typeof assertExports }} */
  const assert = /** @type {*} */(ok);
  for (const k in assertExports) if (!(k in assert)) {
    /** @type {*} */(assert)[k] = /** @type {*} */(assertExports)[k];
  }
  /** @type {*} */(assert).strict = assert;

  return assert;
}

const exports = nodeAssertBody();

export const assert = exports;
export const ok = exports.ok;
export const equal = exports.equal;
export const strictEqual = exports.strictEqual;
export const notEqual = exports.notEqual;
export const notStrictEqual = exports.notStrictEqual;
export const deepEqual = exports.deepEqual;
export const deepStrictEqual = exports.deepStrictEqual;
export const match = exports.match;
export const doesNotMatch = exports.doesNotMatch;
export const throws = exports.throws;
export const doesNotThrow = exports.doesNotThrow;
export const rejects = exports.rejects;
export const doesNotReject = exports.doesNotReject;
export const fail = exports.fail;
export const AssertionError = exports.AssertionError;
export const strict = exports.strict;

export default exports;

export const nodeAssertContent = `
// @ts-check

${nodeAssertBody}

const exports = nodeAssertBody();

export const assert = exports;
export const ok = exports.ok;
export const equal = exports.equal;
export const strictEqual = exports.strictEqual;
export const notEqual = exports.notEqual;
export const notStrictEqual = exports.notStrictEqual;
export const deepEqual = exports.deepEqual;
export const deepStrictEqual = exports.deepStrictEqual;
export const match = exports.match;
export const doesNotMatch = exports.doesNotMatch;
export const throws = exports.throws;
export const doesNotThrow = exports.doesNotThrow;
export const rejects = exports.rejects;
export const doesNotReject = exports.doesNotReject;
export const fail = exports.fail;
export const AssertionError = exports.AssertionError;
export const strict = exports.strict;

export default exports;

`.trim();
