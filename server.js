/**
 * Testly Backend — pure Node.js, zero dependencies
 * Data stored in ./data.json
 * Run: node server.js
 * API:
 *   POST /api/contact      — save contact form submission
 *   GET  /api/contacts     — list all submissions
 *   DELETE /api/contacts/:id — delete one submission
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT      = 3001;
const DATA_FILE = path.join(__dirname, 'data.json');
const STATIC_DIR = path.join(__dirname, 'public');

// ── helpers ──────────────────────────────────────────────────────────────────

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { contacts: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  });
  res.end(body);
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.json':'application/json' };
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

// ── validation ────────────────────────────────────────────────────────────────

function validate(body) {
  const errors = {};
  if (!body.firstName || body.firstName.trim().length < 2)  errors.firstName = 'Минимум 2 символа';
  if (!body.lastName  || body.lastName.trim().length  < 2)  errors.lastName  = 'Минимум 2 символа';
  if (!body.email     || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.email = 'Неверный email';
  if (!body.message   || body.message.trim().length   < 10) errors.message   = 'Минимум 10 символов';
  return errors;
}

// ── server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') { json(res, 204, {}); return; }

  // ── API routes ──
  if (pathname === '/api/contact' && method === 'POST') {
    const body   = await readBody(req);
    const errors = validate(body);
    if (Object.keys(errors).length > 0) { json(res, 422, { ok: false, errors }); return; }

    const data    = loadData();
    const record  = {
      id:        Date.now(),
      firstName: body.firstName.trim(),
      lastName:  body.lastName.trim(),
      email:     body.email.trim().toLowerCase(),
      company:   (body.company || '').trim(),
      topic:     body.topic || 'General inquiry',
      message:   body.message.trim(),
      createdAt: new Date().toISOString(),
    };
    data.contacts.push(record);
    saveData(data);
    console.log(`[+] New contact: ${record.firstName} ${record.lastName} <${record.email}>`);
    json(res, 201, { ok: true, id: record.id, message: 'Сохранено!' });
    return;
  }

  if (pathname === '/api/contacts' && method === 'GET') {
    const data = loadData();
    json(res, 200, { ok: true, total: data.contacts.length, contacts: data.contacts });
    return;
  }

  // DELETE /api/contacts/:id
  const delMatch = pathname.match(/^\/api\/contacts\/(\d+)$/);
  if (delMatch && method === 'DELETE') {
    const id   = parseInt(delMatch[1]);
    const data = loadData();
    const before = data.contacts.length;
    data.contacts = data.contacts.filter(c => c.id !== id);
    if (data.contacts.length === before) { json(res, 404, { ok: false, message: 'Not found' }); return; }
    saveData(data);
    json(res, 200, { ok: true, message: 'Deleted' });
    return;
  }

  // ── Static files ──
  if (pathname === '/' || pathname === '/index.html') {
    serveStatic(res, path.join(STATIC_DIR, 'index.html')); return;
  }
  if (pathname.startsWith('/') && !pathname.startsWith('/api')) {
    serveStatic(res, path.join(STATIC_DIR, pathname)); return;
  }

  json(res, 404, { ok: false, message: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Testly backend running → http://localhost:${PORT}`);
  console.log(`   POST   /api/contact`);
  console.log(`   GET    /api/contacts`);
  console.log(`   DELETE /api/contacts/:id`);
  console.log(`   Static → ./public/\n`);
});
