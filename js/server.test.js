// @ts-check
import { describe, it } from 'node:test';
import { strictEqual, deepStrictEqual } from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { patternToRegex, glob } from './server.js';

describe('patternToRegex', () => {
  it('converts simple filename pattern', () => {
    const regex = patternToRegex('*.js');
    strictEqual(regex.test('file.js'), true);
    strictEqual(regex.test('test.js'), true);
    strictEqual(regex.test('dir/file.js'), false);
    strictEqual(regex.test('file.ts'), false);
  });
  
  it('converts pattern with directory', () => {
    const regex = patternToRegex('src/*.js');
    strictEqual(regex.test('src/file.js'), true);
    strictEqual(regex.test('src/test.js'), true);
    strictEqual(regex.test('file.js'), false);
    strictEqual(regex.test('src/sub/file.js'), false);
  });
  
  it('converts ** at start', () => {
    const regex = patternToRegex('**/*.js');
    strictEqual(regex.test('file.js'), true, 'should match file.js');
    strictEqual(regex.test('dir/file.js'), true, 'should match dir/file.js');
    strictEqual(regex.test('dir/sub/file.js'), true, 'should match dir/sub/file.js');
    strictEqual(regex.test('file.ts'), false);
  });
  
  it('converts ** at end', () => {
    const regex = patternToRegex('src/**');
    strictEqual(regex.test('src/file.js'), true);
    strictEqual(regex.test('src/dir/file.js'), true);
    strictEqual(regex.test('src/dir/sub/file.js'), true);
    strictEqual(regex.test('other/file.js'), false);
  });
  
  it('converts ** in middle', () => {
    const regex = patternToRegex('src/**/test.js');
    strictEqual(regex.test('src/test.js'), true, 'should match src/test.js');
    strictEqual(regex.test('src/dir/test.js'), true, 'should match src/dir/test.js');
    strictEqual(regex.test('src/dir/sub/test.js'), true, 'should match src/dir/sub/test.js');
    strictEqual(regex.test('test.js'), false);
    strictEqual(regex.test('src/other.js'), false);
  });
  
  it('converts multiple ** segments', () => {
    const regex = patternToRegex('**/test/**/*.js');
    strictEqual(regex.test('test/file.js'), true);
    strictEqual(regex.test('dir/test/file.js'), true);
    strictEqual(regex.test('dir/test/sub/file.js'), true);
    strictEqual(regex.test('test/sub/deep/file.js'), true);
    strictEqual(regex.test('file.js'), false);
  });
  
  it('handles just **', () => {
    const regex = patternToRegex('**');
    strictEqual(regex.test('file.js'), true);
    strictEqual(regex.test('dir/file.js'), true);
    strictEqual(regex.test('dir/sub/file.js'), true);
  });
  
  it('handles * wildcard', () => {
    const regex = patternToRegex('test*.js');
    strictEqual(regex.test('test.js'), true);
    strictEqual(regex.test('test123.js'), true);
    strictEqual(regex.test('testing.js'), true);
    strictEqual(regex.test('other.js'), false);
  });
  
  it('handles multiple * wildcards', () => {
    const regex = patternToRegex('*test*.js');
    strictEqual(regex.test('test.js'), true);
    strictEqual(regex.test('mytest.js'), true);
    strictEqual(regex.test('test123.js'), true);
    strictEqual(regex.test('mytestfile.js'), true);
    strictEqual(regex.test('other.js'), false);
  });
  
  it('handles special regex characters', () => {
    const regex = patternToRegex('test.file.js');
    strictEqual(regex.test('test.file.js'), true);
    strictEqual(regex.test('testXfileXjs'), false);
  });
  
  it('handles brackets and parens in filenames', () => {
    const regex = patternToRegex('test[1].js');
    strictEqual(regex.test('test[1].js'), true);
    strictEqual(regex.test('test1.js'), false);
  });
  
  it('handles complex nested pattern', () => {
    const regex = patternToRegex('src/**/test/**/*.test.js');
    strictEqual(regex.test('src/test/file.test.js'), true);
    strictEqual(regex.test('src/components/test/unit.test.js'), true);
    strictEqual(regex.test('src/lib/utils/test/helper.test.js'), true);
    strictEqual(regex.test('src/file.test.js'), false);
    strictEqual(regex.test('test/file.test.js'), false);
  });
  
  it('handles pattern with no wildcards', () => {
    const regex = patternToRegex('src/index.js');
    strictEqual(regex.test('src/index.js'), true);
    strictEqual(regex.test('src/index.ts'), false);
    strictEqual(regex.test('index.js'), false);
  });
  
  it('handles empty segments correctly', () => {
    // Patterns with trailing slashes should be filtered
    const regex = patternToRegex('src/*.js');
    strictEqual(regex.test('src/file.js'), true);
  });
  
  it('handles Windows-style paths by normalizing', () => {
    const regex = patternToRegex('src\\*.js');
    strictEqual(regex.test('src/file.js'), true);
  });
  
  it('handles edge case: **/ followed by **', () => {
    const regex = patternToRegex('**/**/*.js');
    strictEqual(regex.test('file.js'), true);
    strictEqual(regex.test('a/file.js'), true);
    strictEqual(regex.test('a/b/file.js'), true);
  });
  
  it('handles pattern with file extension only', () => {
    const regex = patternToRegex('*.test.js');
    strictEqual(regex.test('foo.test.js'), true);
    strictEqual(regex.test('bar.test.js'), true);
    strictEqual(regex.test('foo.js'), false);
    strictEqual(regex.test('test.js'), false);
  });
});

describe('glob', () => {
  let testRoot = '';
  
  /** Setup test directory structure */
  function setup() {
    testRoot = join(tmpdir(), 'daebug-glob-test-' + Date.now());
    mkdirSync(testRoot, { recursive: true });
    
    // Create test structure:
    // test.js
    // file.test.js
    // src/index.js
    // src/util.test.js
    // src/lib/helper.js
    // src/lib/helper.test.js
    // dist/bundle.js
    // node_modules/pkg/index.js
    
    writeFileSync(join(testRoot, 'test.js'), '// test file');
    writeFileSync(join(testRoot, 'file.test.js'), '// test file');
    
    mkdirSync(join(testRoot, 'src'), { recursive: true });
    writeFileSync(join(testRoot, 'src/index.js'), '// index');
    writeFileSync(join(testRoot, 'src/util.test.js'), '// test');
    
    mkdirSync(join(testRoot, 'src/lib'), { recursive: true });
    writeFileSync(join(testRoot, 'src/lib/helper.js'), '// helper');
    writeFileSync(join(testRoot, 'src/lib/helper.test.js'), '// test');
    
    mkdirSync(join(testRoot, 'dist'), { recursive: true });
    writeFileSync(join(testRoot, 'dist/bundle.js'), '// bundle');
    
    mkdirSync(join(testRoot, 'node_modules/pkg'), { recursive: true });
    writeFileSync(join(testRoot, 'node_modules/pkg/index.js'), '// package');
  }
  
  /** Cleanup test directory */
  function teardown() {
    if (testRoot && existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
  
  it('matches all test files with **/*.test.js', () => {
    setup();
    try {
      const files = glob(testRoot, ['**/*.test.js'], []);
      const basenames = files.map(f => f.replace(testRoot, '').split('\\').join('/'));
      
      strictEqual(basenames.includes('/file.test.js'), true);
      strictEqual(basenames.includes('/src/util.test.js'), true);
      strictEqual(basenames.includes('/src/lib/helper.test.js'), true);
      strictEqual(basenames.includes('/test.js'), false);
      strictEqual(basenames.includes('/src/index.js'), false);
    } finally {
      teardown();
    }
  });
  
  it('excludes node_modules', () => {
    setup();
    try {
      const files = glob(testRoot, ['**/*.js'], ['node_modules/**']);
      const basenames = files.map(f => f.replace(testRoot, '').split('\\').join('/'));
      
      strictEqual(basenames.some(f => f.includes('node_modules')), false);
      strictEqual(basenames.includes('/test.js'), true);
      strictEqual(basenames.includes('/src/index.js'), true);
    } finally {
      teardown();
    }
  });
  
  it('matches nested patterns', () => {
    setup();
    try {
      const files = glob(testRoot, ['src/**/*.js'], []);
      const basenames = files.map(f => f.replace(testRoot, '').split('\\').join('/'));
      
      strictEqual(basenames.includes('/src/index.js'), true);
      strictEqual(basenames.includes('/src/util.test.js'), true);
      strictEqual(basenames.includes('/src/lib/helper.js'), true);
      strictEqual(basenames.includes('/src/lib/helper.test.js'), true);
      strictEqual(basenames.includes('/test.js'), false);
      strictEqual(basenames.includes('/file.test.js'), false);
    } finally {
      teardown();
    }
  });
  
  it('matches with multiple patterns', () => {
    setup();
    try {
      const files = glob(testRoot, ['*.js', 'src/*.js'], []);
      const basenames = files.map(f => f.replace(testRoot, '').split('\\').join('/'));
      
      strictEqual(basenames.includes('/test.js'), true);
      strictEqual(basenames.includes('/file.test.js'), true);
      strictEqual(basenames.includes('/src/index.js'), true);
      strictEqual(basenames.includes('/src/util.test.js'), true);
      // Should not match nested files
      strictEqual(basenames.includes('/src/lib/helper.js'), false);
    } finally {
      teardown();
    }
  });
  
  it('handles multiple exclusion patterns', () => {
    setup();
    try {
      const files = glob(testRoot, ['**/*.js'], ['node_modules/**', 'dist/**']);
      const basenames = files.map(f => f.replace(testRoot, '').split('\\').join('/'));
      
      strictEqual(basenames.some(f => f.includes('node_modules')), false);
      strictEqual(basenames.some(f => f.includes('dist')), false);
      strictEqual(basenames.includes('/test.js'), true);
      strictEqual(basenames.includes('/src/index.js'), true);
    } finally {
      teardown();
    }
  });
  
  it('returns sorted results', () => {
    setup();
    try {
      const files = glob(testRoot, ['**/*.js'], ['node_modules/**']);
      
      // Check if sorted
      for (let i = 1; i < files.length; i++) {
        strictEqual(files[i - 1] < files[i], true, `files should be sorted: ${files[i - 1]} vs ${files[i]}`);
      }
    } finally {
      teardown();
    }
  });
  
  it('handles empty patterns array', () => {
    setup();
    try {
      const files = glob(testRoot, [], []);
      strictEqual(files.length, 0);
    } finally {
      teardown();
    }
  });
  
  it('handles specific file pattern', () => {
    setup();
    try {
      const files = glob(testRoot, ['src/index.js'], []);
      const basenames = files.map(f => f.replace(testRoot, '').split('\\').join('/'));
      
      strictEqual(basenames.length, 1);
      strictEqual(basenames[0], '/src/index.js');
    } finally {
      teardown();
    }
  });
  
  it('handles pattern with no matches', () => {
    setup();
    try {
      const files = glob(testRoot, ['**/*.nonexistent'], []);
      strictEqual(files.length, 0);
    } finally {
      teardown();
    }
  });
  
  it('handles nested directory exclusion', () => {
    setup();
    try {
      const files = glob(testRoot, ['**/*.js'], ['src/lib/**']);
      const basenames = files.map(f => f.replace(testRoot, '').split('\\').join('/'));
      
      strictEqual(basenames.includes('/src/index.js'), true);
      strictEqual(basenames.includes('/src/util.test.js'), true);
      strictEqual(basenames.includes('/src/lib/helper.js'), false);
      strictEqual(basenames.includes('/src/lib/helper.test.js'), false);
    } finally {
      teardown();
    }
  });
});
