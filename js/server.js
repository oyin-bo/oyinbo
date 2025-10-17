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

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

/** @param {string} root @param {number} port */
export function start(root, port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    // REPL endpoint
    if (url.pathname === '/oyinbo') {
      if (req.method === 'GET') return handlePoll(root, url, res);
      if (req.method === 'POST') return handleResult(url, req, res);
    }
    
    // Static files
    let path = url.pathname;
    if (path.endsWith('/')) path += 'index.html';
    if (path === '/') path = '/index.html';
    
    const file = join(root, path);
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    
    // Inject client script into HTML
    if (extname(file) === '.html') {
      const html = readFileSync(file, 'utf8');
      const injected = html.replace('</head>', `<script>${clientScript}</script></head>`);
      res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(injected);
      return;
    }
    
    const type = MIME[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    createReadStream(file).pipe(res);
  });
  
  server.listen(port, () => {
    console.log(`[oyinbo] http://localhost:${port}/`);
  });
}

/** @param {string} root @param {URL} url @param {import('http').ServerResponse} res */
function handlePoll(root, url, res) {
  const name = url.searchParams.get('name') || '';
  const href = url.searchParams.get('url') || '';
  
  if (!name) {
    res.writeHead(400).end('missing name');
    return;
  }
  
  const page = registry.getOrCreate(root, name, href);
  watcher.watchPage(root, page);
  
  const j = job.get(page.name);
  if (!j) {
    // No job, send empty (poll again)
    res.writeHead(200, { 'Content-Type': 'application/javascript' }).end('');
    return;
  }
  
  // Send job
  // Only start the job on the first poll that finds it; job.start is idempotent but avoid extra calls
  if (!j.startedAt) job.start(j);
  res.writeHead(200, {
    'Content-Type': 'application/javascript',
    'x-job-id': j.id
  }).end(j.code);
}

/** @param {URL} url @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res */
function handleResult(url, req, res) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const name = url.searchParams.get('name') || '';
      const j = job.get(name);
      
      if (!j) {
        res.writeHead(200).end('ok');
        return;
      }
      
      writer.writeReply(j, data);
      job.finish(j);
      
      res.writeHead(200).end('ok');
    } catch (err) {
      console.error('[result] error:', err);
      res.writeHead(500).end('error');
    }
  });
}
