/**
 * 前后端接口对账：前端调用清单 vs 后端真实路由
 * 用法：node api-audit.js
 * 输出：已实现 / 缺失 两栏，缺失项标注所属分包页
 */
const fs = require('fs');
const path = require('path');

const FE = 'F:/熵盾公司/熵盾公司/3熵盾小程序/miniprogram-3';
const BE = 'F:/熵盾公司/熵盾公司/7熵盾服务端/entropy-api';

/* ---------- 1. 后端：挂载点 + 子路径 ---------- */
const serverSrc = fs.readFileSync(path.join(BE, 'src/server.js'), 'utf8');
const mounts = [];
const mountRe = /app\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:require\(['"`][^'"`]*['"`]\)|([A-Za-z0-9_]+)\.([A-Za-z0-9_]+))/g;
let m;
while ((m = mountRe.exec(serverSrc))) {
  mounts.push({ prefix: m[1], mod: m[2], exportName: m[3] });
}
// require 形式：从 require 路径反推文件名
const mountRe2 = /app\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*require\(['"`]([^'"`]+)['"`]\)/g;
while ((m = mountRe2.exec(serverSrc))) {
  const file = m[2].split('/').pop();
  mounts.push({ prefix: m[1], file });
}

function routesOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  // 匹配 XRouter.get('/path' 或 router.post(\n  '/path'
  const re = /([A-Za-z0-9_]+)\.(get|post|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let r;
  while ((r = re.exec(src))) out.push({ routerVar: r[1], p: r[3] });
  return out;
}

const beRoutes = new Set();
const routeDir = path.join(BE, 'src/routes');
for (const f of fs.readdirSync(routeDir)) {
  if (!f.endsWith('.js')) continue;
  const full = path.join(routeDir, f);
  const base = f.replace(/\.js$/, '');
  // 所有指向该文件的挂载点
  const prefixes = mounts.filter((x) => (x.file && x.file.replace(/\.js$/, '') === base));
  const rs = routesOf(full);
  for (const r of rs) {
    const hit = prefixes.find((x) => x.prefix);
    beRoutes.add((hit ? hit.prefix : '') + r.p);
  }
}
// daily.js 里有两个 Router 变量、分别挂在不同前缀
const dailyMounts = mounts.filter((x) => x.prefix && /daily|discipline/.test(x.prefix));
for (const dm of dailyMounts) {
  // 该前缀对应的 exportName（如 daily.dailyRouter）
  const exp = (serverSrc.match(new RegExp("app\\.use\\(\\s*['\"`]" + dm.prefix.replace(/\//g, '\\/') + "['\"`]\\s*,\\s*([A-Za-z0-9_]+)\\.([A-Za-z0-9_]+)")) || [])[2];
  if (!exp) continue;
  for (const r of routesOf(path.join(routeDir, 'daily.js'))) {
    if (r.routerVar === exp) beRoutes.add(dm.prefix + r.p);
  }
}

// server.js 里直接定义的路由（不经 routes/ 挂载），如 /api/health、/api/_selfcheck。
// ★ 不扫这里会把已实现的接口误判为缺口（/api/health 就曾因此被误报）。
const directRe = /app\.(get|post|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;
while ((m = directRe.exec(serverSrc))) beRoutes.add(m[2]);

/* ---------- 2. 前端：调用清单 + 归属 ---------- */
const feCalls = new Map(); // path -> Set(调用方)
// ★ 注释里的 "/api/xxx" 不是真实调用（如 utils/recall.js 注释中提到的 /api/recall/*），
//   必须先剥注释再提取，否则会误报缺口。
function stripJsComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, (s, p1) => p1 + s.slice(p1.length).replace(/[^\n]/g, ' '));
  return out;
}
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|wxml|json)$/.test(e.name)) {
      // 按文件类型选择注释剥离方式：js 用 // 与 /* */，wxml 用 <!-- -->，json 无注释
      let src = fs.readFileSync(p, 'utf8');
      if (e.name.endsWith('.js')) src = stripJsComments(src);
      else if (e.name.endsWith('.wxml')) src = src.replace(/<!--[\s\S]*?-->/g, (s) => s.replace(/[^\n]/g, ' '));
      const re = /\/api\/[A-Za-z0-9_\/.\-]*/g;
      let x;
      while ((x = re.exec(src))) {
        const u = x[0].replace(/[.,;)$]+$/, '');
        if (!u || u === '/api/') continue;
        const rel = path.relative(FE, p).replace(/\\/g, '/');
        if (!feCalls.has(u)) feCalls.set(u, new Set());
        feCalls.get(u).add(rel);
      }
    }
  }
}
walk(FE);

/* ---------- 3. 对账 ---------- */
const ok = [], miss = [];
for (const [u, who] of [...feCalls.entries()].sort()) {
  const hit = [...beRoutes].some((b) => b === u || u.startsWith(b + '/'));
  (hit ? ok : miss).push({ u, who: [...who] });
}

console.log('=== 后端已实现端点（' + beRoutes.size + '）===');
[...beRoutes].sort().forEach((b) => console.log('  ' + b));
console.log('\n=== 前端调用已覆盖（' + ok.length + '）===');
ok.forEach((o) => console.log('  ✅ ' + o.u));
console.log('\n=== 前端调用但后端缺失（' + miss.length + '）===');
miss.forEach((o) => console.log('  ❌ ' + o.u + '\n       调用方: ' + o.who.slice(0, 3).join(' | ') + (o.who.length > 3 ? ' …' : '')));
console.log('\n覆盖率: ' + ok.length + '/' + (ok.length + miss.length) + ' = ' + Math.round((ok.length / (ok.length + miss.length)) * 100) + '%');
