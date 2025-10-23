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
import { installShutdownHandlers } from './shutdown.js';
import { formatTestProgress as formatTestProgressTemplate } from './test.template.js';

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
  // Install handlers for graceful shutdown on Ctrl+C and other signals
  installShutdownHandlers(root);
  
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
      return res.writeHead(200, { 
        'Content-Type': MIME['.js'],
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache'
      }).end(DAEBUG_MODULES[url.pathname]);
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
  
  server.listen(port, () => console.log(
    'serving  ' + root +
    '  👉  http://localhost:' + port + '/\n' +
    '=================================================================================\n' +
    '   📃 daebug.md  registry'
  ));
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
      
      // Handle background event flush (orphaned events after job completion)
      if (payload.type === 'background-flush') {
        const page = registry.get(name);
        if (page && payload.events && payload.events.length > 0) {
          writer.writeBackgroundEvents(page.file, payload.events, payload.timestamp);
        }
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
 * Convert glob pattern to regex
 * Supports:
 *   - * matches any chars except /
 *   - ** matches zero or more path segments (directories)
 *   - . and other regex chars are escaped
 * @param {string} pattern
 * @returns {RegExp}
 */
export function patternToRegex(pattern) {
  // Normalize path separators to forward slash
  const normalized = pattern.split(sep).join('/');
  
  // Split by / to process each segment
  const segments = normalized.split('/').filter(s => s !== '');
  const regexParts = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    if (segment === '**') {
      // ** matches zero or more path segments
      if (i === 0 && i === segments.length - 1) {
        // Pattern is just "**" - matches everything
        regexParts.push('.*');
      } else if (i === 0) {
        // At start: matches zero or more segments before the rest
        // Pattern: **/.../... should match .../... or x/.../... or x/y/.../...
        regexParts.push('(?:(?:[^/]+/)*)');
      } else if (i === segments.length - 1) {
        // At end: matches zero or more segments after prefix
        // Pattern: .../** adds optional trailing path
        regexParts.push('(?:.*)?');
      } else {
        // In middle: matches zero or more segments between parts
        regexParts.push('(?:(?:[^/]+/)*)');
      }
    } else {
      // Regular segment - may contain * wildcard
      let segmentRegex = '';
      for (let j = 0; j < segment.length; j++) {
        const char = segment[j];
        if (char === '*') {
          segmentRegex += '[^/]*';
        } else {
          // Escape regex special chars
          segmentRegex += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        }
      }
      regexParts.push(segmentRegex);
    }
  }
  
  if (regexParts.length === 0) {
    // Empty pattern matches everything
    return new RegExp('^.*$');
  }
  
  // Join parts with separators, being careful about ** handling
  let regexStr = '';
  for (let i = 0; i < regexParts.length; i++) {
    const part = regexParts[i];
    
    if (i > 0) {
      const prevPart = regexParts[i - 1];
      // Don't add / if previous part is ** pattern that includes trailing slashes
      // ** patterns: (?:(?:[^/]+/)*) or (?:.*)?
      const prevIsDoubleStar = prevPart.includes('(?:[^/]+/)*)') || prevPart === '(?:.*)?';
      const currentIsDoubleStar = part.includes('(?:[^/]+/)*)') || part === '(?:.*)?' || part === '.*';
      
      // Add separator only if previous is not **, or if both are ** (need separator between them)
      if (!prevIsDoubleStar) {
        regexStr += '/';
      }
    }
    
    regexStr += part;
  }
  
  return new RegExp('^' + regexStr + '$');
}

/**
 * Glob pattern matching - recursively find files matching patterns
 * Returns absolute file paths
 * @param {string} dir - root directory to search from
 * @param {string[]} patterns - glob patterns
 * @param {string[]} exclude - exclusion patterns
 * @returns {string[]} - absolute file paths
 */
export function glob(dir, patterns, exclude) {
  const results = new Set();
  const patternRegexes = patterns.map(p => patternToRegex(p));
  const excludeRegexes = exclude.map(e => patternToRegex(e));
  
  function scan(/** @type {string} */ currentDir) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relPath = relative(dir, fullPath).split(sep).join('/');
        
        // Skip excluded paths
        if (excludeRegexes.some(regex => regex.test(relPath))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile()) {
          // Match against patterns - file must match at least one pattern
          if (patternRegexes.some(regex => regex.test(relPath))) {
            results.add(fullPath);
          }
        }
      }
    } catch (err) {
      // Ignore permission errors etc.
    }
  }
  
  scan(dir);
  return Array.from(results).sort();
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
      
      console.log('   𒀸  patterns:', patterns, 'cwd:', cwd);
      
      const discovered = discoverTestFiles(root, cwd, patterns, exclude);
      const urls = discovered.map(filePath => {
        const rel = relative(root, filePath);
        return '/' + rel.split(sep).join('/');
      });
      
      console.log('   𒀸  found', urls.length, 'test files');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: urls }));
    } catch (err) {
      console.error('   𒀸  error:', err);
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
        console.warn('   𒀸  unknown realm:', realmName);
        return res.writeHead(404).end('realm not found');
      }
      
      // Format test progress as markdown (no server-side delta calculation)
      const markdown = formatTestProgress(payload);
      
      // Write to realm's daebug log
      writer.writeTestProgress(page.file, markdown);
      
      console.log('   𒀸 ', realmName, ':', payload.totals.pass ?? 0, 'pass,', payload.totals.fail ?? 0, 'fail,', payload.totals.skip ?? 0, 'skip');
      res.writeHead(200).end('ok');
    } catch (err) {
      console.error('   𒀸  error:', err);
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
    console.warn('   𒀸  cwd outside root:', cwdAbs, 'vs', rootAbs);
    return [];
  }
  
  // Use the glob function directly
  const discovered = glob(cwdAbs, patterns, exclude);
  
  // Filter to ensure all files are within root (security)
  return discovered.filter(file => {
    const abs = resolve(file);
    return abs.startsWith(rootAbs);
  }).sort();
}

/**
 * Format test progress as markdown - delegates to template function
 * @param {any} payload
 * @returns {string}
 */
function formatTestProgress(payload) {
  return formatTestProgressTemplate(payload);
}
