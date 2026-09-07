/**
 * 线上接口探测 probe-api.js
 *
 * 用途：直接打线上 api.entropyshield.com，逐个探测前端调用的接口是否真实存在。
 * 与 api-audit.js 的区别（关键）：
 *   - api-audit.js  = 前端调用 vs 【本地源码】（可能和线上不一致）
 *   - probe-api.js  = 前端调用 vs 【线上真实响应】（唯一权威口径）
 *
 * 判定逻辑：
 *   - 先 GET 探测；若 404 再 POST（空 body）探测
 *   - 404        → 路由不存在（真缺口）
 *   - 400/401/422 → 路由存在（参数校验拦下），不是缺口
 *   - 200        → 路由存在且有响应
 *
 * 安全：POST 一律空 body，且跳过 virtual-pay/create 等有副作用的接口。
 *
 * 用法：node tools/probe-api.js [前端根目录] [主机名，默认 api.entropyshield.com]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = process.argv[2] || 'F:/熵盾公司/熵盾公司/3熵盾小程序/miniprogram-3';
const HOST = process.argv[3] || 'api.entropyshield.com';

/* 有真实副作用的接口：只做 GET 探测，绝不 POST */
const SKIP_POST = [/virtual-pay\/create/, /\/pay\/create/, /charge/, /refund/];

/* ---------- 提取前端调用的接口路径 ---------- */
function stripComments(s) {
  return String(s)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // 块注释
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); // 行注释（避开 https:// 与字符串内的 //）
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (/node_modules|\.git$/.test(name)) continue;
      walk(p, out);
    } else if (/\.(js|wxml)$/i.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const calls = new Map(); // path -> Set(来源文件)
const SCAN_DIRS = ['utils', 'pages', 'app.js'];
for (const d of SCAN_DIRS) {
  const full = path.join(ROOT, d);
  const files = fs.existsSync(full)
    ? (fs.statSync(full).isDirectory() ? walk(full) : [full])
    : [];
  for (const f of files) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    const re = /\/api\/[A-Za-z0-9_\/.\-]*/g;
    let m;
    while ((m = re.exec(src))) {
      let p = m[0].replace(/[.,;)\]}'"]+$/, '');
      if (!p || p === '/api' || p === '/api/') continue;
      if (!calls.has(p)) calls.set(p, new Set());
      calls.get(p).add(path.relative(ROOT, f).replace(/\\/g, '/'));
    }
  }
}
// 分包目录也要扫（pkg*）
for (const name of fs.readdirSync(ROOT)) {
  if (!/^pkg[A-Za-z0-9]*$/.test(name)) continue;
  for (const f of walk(path.join(ROOT, name))) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    const re = /\/api\/[A-Za-z0-9_\/.\-]*/g;
    let m;
    while ((m = re.exec(src))) {
      let p = m[0].replace(/[.,;)\]}'"]+$/, '');
      if (!p || p === '/api' || p === '/api/') continue;
      if (!calls.has(p)) calls.set(p, new Set());
      calls.get(p).add(path.relative(ROOT, f).replace(/\\/g, '/'));
    }
  }
}

/* ---------- 探测 ---------- */
function probe(method, apiPath, timeout = 8000) {
  return new Promise((resolve) => {
    const body = method === 'POST' ? '{}' : null;
    const opts = {
      hostname: HOST, port: 443, path: apiPath, method,
      timeout,
      headers: Object.assign(
        { 'User-Agent': 'entropy-probe/1.0' },
        body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
      )
    };
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; if (buf.length > 400) res.destroy(); });
      res.on('end', () => finish({ code: res.statusCode, body: buf.slice(0, 120) }));
      res.on('error', () => finish({ code: res.statusCode, body: buf.slice(0, 120) }));
    });
    req.on('timeout', () => { req.destroy(); finish({ code: 0, body: 'TIMEOUT' }); });
    req.on('error', (e) => finish({ code: 0, body: 'ERR:' + (e.code || e.message) }));
    if (body) req.write(body);
    req.end();
  });
}

async function probeOne(apiPath) {
  const g = await probe('GET', apiPath);
  if (g.code === 404) {
    if (SKIP_POST.some((re) => re.test(apiPath))) {
      return { code: 404, method: 'GET(only)', body: g.body, skipped: true };
    }
    const p = await probe('POST', apiPath);
    return { code: p.code, method: 'POST', body: p.body };
  }
  return { code: g.code, method: 'GET', body: g.body };
}

(async () => {
  const list = Array.from(calls.keys()).sort();
  console.log('=== 线上接口探测：' + HOST + ' ===');
  console.log('前端调用接口数：' + list.length + '\n');

  const exists = [], missing = [], weird = [];
  const BATCH = 5;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    const rs = await Promise.all(slice.map(probeOne));
    slice.forEach((p, k) => {
      const r = rs[k];
      const line = { path: p, ...r, from: Array.from(calls.get(p)).join(', ') };
      if (r.code === 404) missing.push(line);
      else if (r.code === 0) weird.push(line);
      else exists.push(line);
    });
  }

  console.log('✅ 线上存在 (' + exists.length + ')');
  exists.forEach((l) => console.log('   ' + String(l.code) + '  ' + l.method.padEnd(10) + ' ' + l.path));
  console.log('\n❌ 线上 404 缺失 (' + missing.length + ')');
  missing.forEach((l) => console.log('   404  ' + (l.skipped ? 'GET-only ' : '') + l.path + '   ← ' + l.from));
  if (weird.length) {
    console.log('\n⚠️ 无法判定 (' + weird.length + ')');
    weird.forEach((l) => console.log('   ' + l.body + '  ' + l.path));
  }
  const total = exists.length + missing.length + weird.length;
  console.log('\n覆盖率：' + exists.length + '/' + total + ' = ' +
    (total ? Math.round((exists.length / total) * 100) : 0) + '%');
})();
