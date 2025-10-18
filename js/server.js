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
    
    if (url.pathname === '/oyinbo') {
      if (req.method === 'GET') return handlePoll(root, url, res);
      if (req.method === 'POST') return handleResult(url, req, res);
    }
    
    let path = url.pathname === '/' || url.pathname.endsWith('/') 
      ? url.pathname + (url.pathname === '/' ? 'index.html' : 'index.html')
      : url.pathname;
    
    const file = join(root, path);
    if (!existsSync(file)) return res.writeHead(404).end('Not found');
    
    if (extname(file) === '.html') {
      const injected = readFileSync(file, 'utf8').replace('</head>', `<script>${clientScript}</script></head>`);
      return res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(injected);
    }
    
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  
  server.listen(port, () => console.log(`[oyinbo] http://localhost:${port}/`));
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
      const j = job.get(url.searchParams.get('name') || '');
      if (j) {
        writer.writeReply(j, JSON.parse(body));
        job.finish(j);
      }
      res.writeHead(200).end('ok');
    } catch (err) {
      console.error('[result] error:', err);
      res.writeHead(500).end('error');
    }
  });
}
