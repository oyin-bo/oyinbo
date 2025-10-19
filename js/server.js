// @ts-check
import { createServer } from 'node:http';
import { readFileSync, createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative, sep, resolve, normalize } from 'node:path';
import { URL } from 'node:url';
import * as registry from './registry.js';
import * as job from './job.js';
import * as writer from './writer.js';
import * as watcher from './watcher.js';
import { clientScript } from './client.js';
import { testRunnerModule, assertModule, workerBootstrapModule } from './modules-loader.js';

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

/** @type {Record<string, string>} */
const DAEBUG_MODULES = {
  '/daebug/test-runner.js': testRunnerModule,
  '/daebug/assert.js': assertModule,
  '/daebug/worker-bootstrap.js': workerBootstrapModule
};

/** @param {string} root @param {number} port */
export function start(root, port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    // Polling endpoints
    if (url.pathname === '/daebug') {
      if (req.method === 'GET') return handlePoll(root, url, res);
      if (req.method === 'POST') return handleResult(url, req, res);
    }
    
    // Daebug modules (test-runner.js, assert.js)
    if (url.pathname in DAEBUG_MODULES) {
      console.log(`👾serving module: ${url.pathname}`);
      return res.writeHead(200, { 'Content-Type': MIME['.js'] })
        .end(DAEBUG_MODULES[url.pathname]);
    }
    
    // Test discovery endpoint
    if (url.pathname === '/daebug/discover-tests' && req.method === 'POST') {
      return handleTestDiscovery(root, req, res);
    }
    
    // Test progress streaming endpoint
    if (url.pathname === '/daebug/test-progress' && req.method === 'POST') {
      return handleTestProgress(req, res);
    }
    
    // File serving with import map handling
    let path = url.pathname === '/' || url.pathname.endsWith('/') 
      ? url.pathname + (url.pathname === '/' ? 'index.html' : 'index.html')
      : url.pathname;
    
    const file = join(root, path);
    if (!existsSync(file)) {
      console.log(`👾𝟰𝟬𝟰 ${url.pathname}`);
      return res.writeHead(404).end('Not found');
    }
    
    // HTML files: inject/merge import maps and client script
    if (extname(file) === '.html') {
      const html = readFileSync(file, 'utf8');
      const modified = processImportMapHTML(html, root);
      const withClient = injectClientScript(modified);
      console.log(`👾serving HTML with import map injected: ${path}`);
      return res.writeHead(200, { 'Content-Type': MIME['.html'] })
        .end(withClient);
    }
    
    // JSON files: check if import map, merge if yes
    if (extname(file) === '.json') {
      const content = readFileSync(file, 'utf8');
      try {
        const json = JSON.parse(content);
        if (json.imports || json.scopes) {
          // It's an import map - merge daebug mappings
          const merged = mergeImportMaps(json);
          return res.writeHead(200, { 'Content-Type': MIME['.json'] })
            .end(JSON.stringify(merged));
        }
      } catch (e) {
        // Not JSON or invalid - serve as-is
      }
      return res.writeHead(200, { 'Content-Type': MIME['.json'] })
        .end(content);
    }
    
    // Everything else: stream as-is
    // Add cache-busting headers for JS files to prevent server-side caching
    const headers = { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' };
    if (extname(file) === '.js') {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      headers['Pragma'] = 'no-cache';
    }
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
  });
  
  server.listen(port, () => console.log(`👾 http://localhost:${port}/`));
}

/**
 * Process HTML to detect/inject/merge import maps
 * @param {string} html
 * @param {string} root
 * @returns {string}
 */
function processImportMapHTML(html, root) {
  const daebugMappings = {
    'node:test': '/daebug/test-runner.js',
    'node:assert': '/daebug/assert.js',
    'node:assert/strict': '/daebug/assert.js'
  };
  
  // Check for inline import maps
  // Matches: <script type="importmap">...</script> with any attributes and quote styles
  const inlineRegex = /<script\s+(?:[^>]*\s+)?type\s*=\s*["']?importmap["']?(?:\s+[^>]*)?>([^]*?)<\/script>/gi;
  let match = inlineRegex.exec(html);
  
  if (match) {
    // Inline import map found - parse and merge
    try {
      const mapContent = match[1];
      const existing = JSON.parse(mapContent);
      const merged = {
        imports: {
          ...daebugMappings,
          ...existing.imports
        },
        ...(existing.scopes && { scopes: existing.scopes })
      };
      const newMapScript = `<script type="importmap">\n${JSON.stringify(merged, null, 2)}\n</script>`;
      return html.replace(match[0], newMapScript);
    } catch (e) {
      console.warn('👾𝗽𝗮𝗿𝘀𝗲 failed for inline import map:', e);
      // Continue - will inject new one below
    }
  }
  
  // Check for external import maps (src attribute)
  // Note: The merging happens in the JSON file handler (processImportMapFile)
  // No changes needed to HTML here - file handling takes care of merging
  const srcRegex = /<script\s+(?:[^>]*\s+)?type\s*=\s*["']?importmap["']?(?:\s+[^>]*\s+)?src\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi;
  if (srcRegex.test(html)) {
    return html;  // Leave HTML as-is, file handling takes care of merging
  }
  
  // No import map found - inject one
  const newMap = `<script type="importmap">\n${JSON.stringify({imports: daebugMappings}, null, 2)}\n</script>`;
  return injectImportMap(html, newMap);
}

/**
 * Inject import map script at best location in HTML
 * @param {string} html
 * @param {string} mapScript
 * @returns {string}
 */
function injectImportMap(html, mapScript) {
  // Try </head>
  if (html.includes('</head>')) {
    return html.replace('</head>', `${mapScript}\n</head>`);
  }
  
  // Try before first <script>
  if (html.includes('<script')) {
    return html.replace('<script', `${mapScript}\n<script`);
  }
  
  // Try <body>
  if (html.includes('<body')) {
    return html.replace('<body', `${mapScript}\n<body`);
  }
  
  // Last resort: prepend
  return mapScript + '\n' + html;
}

/**
 * Inject client REPL script at end of body
 * @param {string} html
 * @returns {string}
 */
function injectClientScript(html) {
  const script = `<script>${clientScript}</script>`;
  
  // Try </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}\n</body>`);
  }
  
  // Try </html>
  if (html.includes('</html>')) {
    return html.replace('</html>', `${script}\n</html>`);
  }
  
  // Last resort: append
  return html + '\n' + script;
}

/**
 * Merge import maps with daebug mappings
 * @param {any} existing
 * @returns {any}
 */
function mergeImportMaps(existing) {
  const daebugMappings = {
    'node:test': '/daebug/test-runner.js',
    'node:assert': '/daebug/assert.js',
    'node:assert/strict': '/daebug/assert.js'
  };
  
  return {
    imports: {
      ...daebugMappings,
      ...existing.imports
    },
    ...(existing.scopes && { scopes: existing.scopes })
  };
}

/** @param {string} root @param {URL} url @param {import('http').ServerResponse} res */
async function handlePoll(root, url, res) {
  const name = url.searchParams.get('name') || '';
  if (!name) return res.writeHead(400).end('missing name');
  
  const page = registry.getOrCreate(root, name, url.searchParams.get('url') || '');
  watcher.watchPage(root, page);
  
  let j = job.get(page.name);
  if (!j) {
    // Long-polling: wait for a job to become available (randomized 10-15s timeout)
    const pollTimeout = 10000 + Math.random() * 5000;
    j = await job.waitForJob(page.name, pollTimeout);
  }
  
  if (!j) {
    return res.writeHead(200, { 'Content-Type': 'application/javascript' }).end('');
  }
  
  if (!j.startedAt) job.start(j);
  res.writeHead(200, { 'Content-Type': 'application/javascript', 'x-job-id': j.id }).end(j.code);
}

/** @param {URL} url @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res */
function handleResult(url, req, res) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const name = url.searchParams.get('name') || '';
      
      // Handle worker timeout diagnostics
      if (payload.type === 'worker-timeout') {
        const page = registry.get(name);
        if (page) {
          writer.writeDiagnostic(
            page.file,
            `Worker unresponsive for ${payload.duration}ms, restarting...`
          );
        }
        return res.writeHead(200).end('ok');
      }
      
      // Handle worker init messages
      if (payload.type === 'worker-init') {
        // Just acknowledge, worker will poll normally
        return res.writeHead(200).end('ok');
      }
      
      // Handle normal job results
      const j = job.get(name);
      if (j) {
        writer.writeReply(j, payload);
        job.finish(j);
      }
      res.writeHead(200).end('ok');
    } catch (err) {
      console.error('[result] error:', err);
      res.writeHead(500).end('error');
    }
  });
}

/**
 * Discover test files matching patterns
 * @param {string} root
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function handleTestDiscovery(root, req, res) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const patterns = Array.isArray(payload.files) ? payload.files : [payload.files || '**/*.test.js'];
      const cwd = payload.cwd || root;
      const exclude = payload.exclude || ['node_modules/**', '.git/**', 'dist/**', 'build/**'];
      
      console.log('[test-discovery] patterns:', patterns, 'cwd:', cwd);
      
      const discovered = discoverTestFiles(root, cwd, patterns, exclude);
      const urls = discovered.map(filePath => {
        const rel = relative(root, filePath);
        return '/' + rel.split(sep).join('/');
      });
      
      console.log('[test-discovery] found', urls.length, 'test files');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: urls }));
    } catch (err) {
      console.error('[test-discovery] error:', err);
      res.writeHead(500).end(JSON.stringify({ error: String(err) }));
    }
  });
}

/**
 * Handle test progress streaming
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function handleTestProgress(req, res) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const realmName = payload.realmName || 'unknown';
      const page = registry.get(realmName);
      
      if (!page) {
        console.warn('[test-progress] unknown realm:', realmName);
        return res.writeHead(404).end('realm not found');
      }
      
      // Format test progress as markdown
      const markdown = formatTestProgress(payload);
      
      // Write to realm's daebug log
      writer.writeTestProgress(page.file, markdown);
      
      console.log('[test-progress]', realmName, ':', payload.totals?.total || 0, 'tests');
      res.writeHead(200).end('ok');
    } catch (err) {
      console.error('[test-progress] error:', err);
      res.writeHead(500).end('error');
    }
  });
}

/**
 * Discover test files matching patterns with validation
 * @param {string} root - document root (security boundary)
 * @param {string} cwd - current working directory for pattern matching
 * @param {string[]} patterns - glob patterns
 * @param {string[]} exclude - exclusion patterns
 * @returns {string[]} - absolute file paths
 */
function discoverTestFiles(root, cwd, patterns, exclude) {
  const rootAbs = resolve(root);
  const cwdAbs = resolve(cwd);
  
  // Security: ensure cwd is within root
  if (!cwdAbs.startsWith(rootAbs)) {
    console.warn('[test-discovery] cwd outside root:', cwdAbs, 'vs', rootAbs);
    return [];
  }
  
  const discovered = new Set();
  
  for (const pattern of patterns) {
    const files = findTestFiles(cwdAbs, pattern, exclude);
    for (const file of files) {
      const abs = resolve(file);
      // Security: validate file is within root
      if (abs.startsWith(rootAbs)) {
        discovered.add(abs);
      }
    }
  }
  
  return Array.from(discovered).sort();
}

/**
 * Find test files matching a pattern
 * @param {string} dir - directory to search
 * @param {string} pattern - pattern like "**\/*.test.js" or "./tests/foo.test.js"
 * @param {string[]} exclude - exclusion patterns
 * @returns {string[]} - absolute file paths
 */
function findTestFiles(dir, pattern, exclude) {
  const results = [];
  
  // If pattern is an explicit file path, return it directly
  if (pattern.includes('.test.js') && !pattern.includes('*')) {
    const explicit = resolve(dir, pattern);
    if (existsSync(explicit) && isTestFile(explicit)) {
      return [explicit];
    }
    return [];
  }
  
  // Otherwise do recursive search for test files
  function scan(/** @type {string} */ currentDir) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relPath = relative(dir, fullPath);
        
        // Check exclusions
        if (exclude.some(ex => matchPattern(relPath, ex))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile() && isTestFile(entry.name)) {
          // Match test file patterns
          if (pattern === '**/*.test.js' || pattern.includes('**/*')) {
            results.push(fullPath);
          } else if (matchPattern(relPath, pattern)) {
            results.push(fullPath);
          }
        }
      }
    } catch (err) {
      // Ignore permission errors etc.
    }
  }
  
  scan(dir);
  return results;
}

/**
 * Check if filename matches test file conventions
 * @param {string} filename
 * @returns {boolean}
 */
function isTestFile(filename) {
  return filename.endsWith('.test.js') || 
         filename.endsWith('.test.mjs') || 
         filename.endsWith('.test.cjs') ||
         filename.startsWith('test-') && (filename.endsWith('.js') || filename.endsWith('.mjs'));
}

/**
 * Simple pattern matching (supports * and **)
 * @param {string} path
 * @param {string} pattern
 * @returns {boolean}
 */
function matchPattern(path, pattern) {
  // Convert pattern to regex
  const regexStr = pattern
    .split('/').map(part => {
      if (part === '**') return '.*';
      if (part === '*') return '[^/]*';
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    }).join('/');
  
  const regex = new RegExp('^' + regexStr + '$');
  return regex.test(path.split(sep).join('/'));
}

/**
 * Format test progress as markdown
 * @param {any} payload
 * @returns {string}
 */
function formatTestProgress(payload) {
  const { totals, duration, recentTests, allTests, complete } = payload;
  const lines = [];
  
  if (complete) {
    lines.push(`## Test Results: ${totals.pass} pass, ${totals.fail} fail, ${totals.skip} skip (${duration}ms)`);
  } else {
    lines.push(`## Test Progress: ${totals.pass}/${totals.total} pass, ${totals.fail} fail (${duration}ms)`);
  }
  lines.push('');
  
  // For final results, use allTests; for progress updates, use recentTests
  const testsToShow = complete && allTests ? allTests : recentTests;
  
  if (testsToShow && testsToShow.length > 0) {
    // Separate failed, skipped, and passed tests for better visibility
    const failedTests = testsToShow.filter(/** @type {any} */ t => t.status === 'fail');
    const skippedTests = testsToShow.filter(/** @type {any} */ t => t.status === 'skip');
    const passedTests = testsToShow.filter(/** @type {any} */ t => t.status === 'pass');
    
    // Show failures first (most important)
    for (const test of failedTests) {
      const suite = test.suite ? `${test.suite} > ` : '';
      lines.push(`✗ ${suite}${test.name} (${test.duration}ms)`);
      
      if (test.error) {
        lines.push('  ```');
        lines.push('  ' + test.error.replace(/\n/g, '\n  '));
        lines.push('  ```');
      }
    }
    
    // Show skipped tests
    for (const test of skippedTests) {
      const suite = test.suite ? `${test.suite} > ` : '';
      lines.push(`○ ${suite}${test.name} (${test.duration}ms)`);
    }
    
    // Show passed tests
    for (const test of passedTests) {
      const suite = test.suite ? `${test.suite} > ` : '';
      lines.push(`✓ ${suite}${test.name} (${test.duration}ms)`);
    }
  }
  
  return lines.join('\n');
}
