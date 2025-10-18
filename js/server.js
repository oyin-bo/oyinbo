// @ts-check
import { createServer } from 'node:http';
import { readFileSync, createReadStream, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
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
const OYINBO_MODULES = {
  '/oyinbo/test-runner.js': testRunnerModule,
  '/oyinbo/assert.js': assertModule,
  '/oyinbo/worker-bootstrap.js': workerBootstrapModule
};

/** @param {string} root @param {number} port */
export function start(root, port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    // Polling endpoints
    if (url.pathname === '/oyinbo') {
      if (req.method === 'GET') return handlePoll(root, url, res);
      if (req.method === 'POST') return handleResult(url, req, res);
    }
    
    // Oyinbo modules (test-runner.js, assert.js)
    if (url.pathname in OYINBO_MODULES) {
      return res.writeHead(200, { 'Content-Type': MIME['.js'] })
        .end(OYINBO_MODULES[url.pathname]);
    }
    
    // File serving with import map handling
    let path = url.pathname === '/' || url.pathname.endsWith('/') 
      ? url.pathname + (url.pathname === '/' ? 'index.html' : 'index.html')
      : url.pathname;
    
    const file = join(root, path);
    if (!existsSync(file)) return res.writeHead(404).end('Not found');
    
    // HTML files: inject/merge import maps and client script
    if (extname(file) === '.html') {
      const html = readFileSync(file, 'utf8');
      const modified = processImportMapHTML(html, root);
      const withClient = injectClientScript(modified);
      return res.writeHead(200, { 'Content-Type': MIME['.html'] })
        .end(withClient);
    }
    
    // JSON files: check if import map, merge if yes
    if (extname(file) === '.json') {
      const content = readFileSync(file, 'utf8');
      try {
        const json = JSON.parse(content);
        if (json.imports || json.scopes) {
          // It's an import map - merge oyinbo mappings
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
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  
  server.listen(port, () => console.log(`[oyinbo] http://localhost:${port}/`));
}

/**
 * Process HTML to detect/inject/merge import maps
 * @param {string} html
 * @param {string} root
 * @returns {string}
 */
function processImportMapHTML(html, root) {
  const oyinboMappings = {
    'node:test': '/oyinbo/test-runner.js',
    'node:assert': '/oyinbo/assert.js'
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
          ...oyinboMappings,
          ...existing.imports
        },
        ...(existing.scopes && { scopes: existing.scopes })
      };
      const newMapScript = `<script type="importmap">${JSON.stringify(merged)}</script>`;
      return html.replace(match[0], newMapScript);
    } catch (e) {
      console.warn('[oyinbo] failed to parse inline import map:', e);
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
  const newMap = `<script type="importmap">${JSON.stringify({imports: oyinboMappings})}</script>`;
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
 * Merge import maps with oyinbo mappings
 * @param {any} existing
 * @returns {any}
 */
function mergeImportMaps(existing) {
  const oyinboMappings = {
    'node:test': '/oyinbo/test-runner.js',
    'node:assert': '/oyinbo/assert.js'
  };
  
  return {
    imports: {
      ...oyinboMappings,
      ...existing.imports
    },
    ...(existing.scopes && { scopes: existing.scopes })
  };
}

/** @param {string} root @param {URL} url @param {import('http').ServerResponse} res */
function handlePoll(root, url, res) {
  const name = url.searchParams.get('name') || '';
  if (!name) return res.writeHead(400).end('missing name');
  
  const page = registry.getOrCreate(root, name, url.searchParams.get('url') || '');
  watcher.watchPage(root, page);
  
  const j = job.get(page.name);
  if (!j) return res.writeHead(200, { 'Content-Type': 'application/javascript' }).end('');
  
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
