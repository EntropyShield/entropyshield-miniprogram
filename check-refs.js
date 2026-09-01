#!/usr/bin/env node
/**
 * check-refs.js —— 小程序「页面引用完整性」体检
 *
 * 相比旧的 check-pages.js，本脚本补齐了四大盲区：
 *   1. 旧脚本只扫 ./pages，本脚本扫全库（含 4 个分包）
 *   2. 旧脚本只认 /pages/** 绝对路径，本脚本兼容相对路径（../、./）
 *   3. 旧脚本不认分包页面，本脚本把 subpackages 也算作合法页面
 *   4. 旧脚本不排注释，被注释掉的跳转会一直误报（如 mainchainDebug）
 *
 * 检查项：
 *   A. app.json 注册的页面，四件套文件是否齐全（js/wxml/json）
 *   B. 代码中所有跳转引用，目标页面是否已注册（悬挂引用）
 *   C. tabBar 合规性：switchTab 必须指向 tabBar 页；navigateTo/redirectTo 不得指向 tabBar 页
 *   D. tabBar 页面必须注册在主包（微信硬性要求）
 *
 * 退出码：0 = 全部通过；1 = 存在 ERROR
 *
 * 用法：node check-refs.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKIP_DIRS = new Set(['node_modules', 'miniprogram_npm', '.git', '.workbuddy', 'sitemap']);
const ASSET_EXT = /\.(js|wxml|wxss|json|png|jpe?g|gif|svg|webp|mp3|mp4|ttf|woff2?)$/i;

let errors = 0;
let warnings = 0;
const err = (m) => { errors++; console.log('  [ERROR] ' + m); };
const warn = (m) => { warnings++; console.log('  [WARN ] ' + m); };

/* ---------- 读 app.json ---------- */
function readAppJson() {
  const raw = fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

const app = readAppJson();

// 已注册页面（统一为不带前导斜杠的相对路径，如 pages/index/index、pkgReport/riskReport/index）
const registered = new Map(); // path -> 'main' | 分包 root
(app.pages || []).forEach((p) => registered.set(String(p).trim().replace(/^\//, ''), 'main'));
const subpackages = app.subpackages || app.subPackages || [];
subpackages.forEach((s) => {
  const root = String(s.root || '').replace(/^\/|\/$/g, '');
  (s.pages || []).forEach((p) => {
    registered.set((root + '/' + String(p).trim().replace(/^\//, '')).replace(/\/+/g, '/'), root);
  });
});

const tabBarPages = new Set(
  ((app.tabBar && app.tabBar.list) || []).map((t) => String(t.pagePath || '').replace(/^\//, ''))
);

/* ---------- 遍历源码文件 ---------- */
function walk(dir, out) {
  out = out || [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(p, out);
    } else if (/\.(js|wxml)$/i.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

/* ---------- 去注释（避免注释里的跳转误报） ---------- */
function stripComments(src, isWxml) {
  let s = src;
  // 块注释
  if (isWxml) s = s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // 行注释：// 前面不能是 : （避免误伤 http://、https://）
  s = s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
  return s;
}

/* ---------- 模板字符串表达式占位（让 [^{}] 边界判断不被 ${} 里的花括号干扰）---------- */
// 仅单行替换、不删换行，行号保持准确
// 用不可打印字符 \u0000 占位：它不在页面路径的合法字符类里，
// 因此路径正则会自然在其处截断，不会像 "__EXPR__" 那样被误吞进路径。
function stripTemplateExpr(s) {
  return s.replace(/\$\{[^{}\n]*\}/g, '\u0000');
}

/* ---------- 抽取跳转引用 ---------- */
// 匹配：wx.navigateTo/redirectTo/reLaunch/switchTab({ url: 'xxx' })
// ★ [^{}] 保证 url 一定在同一个调用对象内，不会跨行串到下一个调用去；
// ★ 引号含反引号，兼容 url: `/pkgX/y/index?a=${b}` 这种模板字符串写法。
const API_RE = /\b(?:wx\.)?(navigateTo|redirectTo|reLaunch|switchTab)\s*\(\s*\{[^{}]{0,400}?\burl\s*:\s*(['"`])([^'"`]*)\2/g;
// 匹配：<navigator url="xxx">
const NAV_RE = /<navigator\b[^>]*?\burl\s*=\s*"([^"]*)"/g;
// 匹配：裸的页面路径字符串（'pages/xx/index'、'/pkgReport/xx/index'）
const STR_RE = /(['"`])\/?((?:pages|pkg[A-Za-z0-9]*)\/[A-Za-z0-9_\-\/]+)\1/g;

function collect(file) {
  const isWxml = /\.wxml$/i.test(file);
  const src = stripTemplateExpr(stripComments(fs.readFileSync(file, 'utf8'), isWxml));
  const out = [];

  const lineOf = (idx) => src.slice(0, idx).split('\n').length;

  let m;
  API_RE.lastIndex = 0;
  while ((m = API_RE.exec(src))) out.push({ api: m[1], url: m[3], line: lineOf(m.index) });

  NAV_RE.lastIndex = 0;
  while ((m = NAV_RE.exec(src))) out.push({ api: 'navigator', url: m[1], line: lineOf(m.index) });

  STR_RE.lastIndex = 0;
  while ((m = STR_RE.exec(src))) out.push({ api: 'string', url: m[2], line: lineOf(m.index) });

  return out;
}

/* ---------- 路径规范化 ---------- */
function resolveUrl(url, file) {
  // 模板字符串残留的 ${...} 占位：只取其前面的静态部分
  let u = String(url).split('\u0000')[0].trim().split('?')[0].split('#')[0];
  if (!u) return null;
  // ★ 小程序路径规则（重要，否则会误报一大片）：
  //   "/pages/x/index" 和 "pages/x/index" 等价，都从【代码包根目录】算起；
  //   只有 "./" 或 "../" 开头才是相对当前页面的相对路径。
  let p;
  if (u.startsWith('./') || u.startsWith('../')) {
    p = path.posix.normalize(path.posix.join(path.dirname(toPosix(path.relative(ROOT, file))), u));
  } else {
    p = u.replace(/^\//, '');
  }
  // 去掉末尾的 /index.js 之类的扩展名
  p = p.replace(/\.(js|wxml|wxss|json)$/i, '');
  return /^(pages|pkg[A-Za-z0-9]*)\//.test(p) ? p : null;
}

function toPosix(p) { return p.split(path.sep).join('/'); }

/* ================= 开始检查 ================= */
console.log('===== 小程序页面引用完整性体检 =====\n');

console.log('[A] app.json 注册页面 -> 文件齐全性');
let fileMissing = 0;
for (const p of [...registered.keys()].sort()) {
  ['js', 'wxml', 'json'].forEach((ext) => {
    const f = path.join(ROOT, p + '.' + ext);
    if (!fs.existsSync(f)) { err('页面 ' + p + ' 缺少 ' + ext + ' 文件'); fileMissing++; }
  });
}
console.log('  已注册页面 ' + registered.size + ' 个（主包 ' + (app.pages || []).length +
  ' + 分包 ' + (registered.size - (app.pages || []).length) + '），缺失文件 ' + fileMissing + ' 处\n');

console.log('[B] 代码跳转引用 -> 目标是否已注册');
const files = walk(ROOT).filter((f) => !/check-refs\.js$|check-pages\.js$/.test(f));
const checked = new Set();
let dangling = 0;
const seen = new Set();
for (const f of files) {
  for (const r of collect(f)) {
    const p = resolveUrl(r.url, f);
    if (!p) continue;                       // 不是页面路径（可能是 http、utils、components）
    if (ASSET_EXT.test(r.url)) continue;
    const key = f + ':' + r.line + ':' + p;
    if (seen.has(key)) continue;
    seen.add(key);
    checked.add(p);
    if (!registered.has(p)) {
      err('悬挂引用 -> ' + p + '\n            ' + toPosix(path.relative(ROOT, f)) + ':' + r.line +
        '  [' + r.api + '] url="' + r.url + '"');
      dangling++;
    }
  }
}
console.log('  扫描文件 ' + files.length + ' 个，页面引用 ' + checked.size + ' 个不同目标，悬挂 ' + dangling + ' 处\n');

console.log('[C] tabBar 跳转方式合规性');
const tabSet = tabBarPages;
let tabBad = 0;
for (const f of files) {
  for (const r of collect(f)) {
    if (r.api === 'string' || r.api === 'navigator') continue;
    const p = resolveUrl(r.url, f);
    if (!p) continue;
    if (r.api === 'switchTab' && !tabSet.has(p)) {
      err('switchTab 指向非 tabBar 页 -> ' + p + '（' + toPosix(path.relative(ROOT, f)) + ':' + r.line + '）');
      tabBad++;
    }
    if ((r.api === 'navigateTo' || r.api === 'redirectTo') && tabSet.has(p)) {
      err(r.api + ' 指向 tabBar 页 -> ' + p + '（应用 switchTab；' + toPosix(path.relative(ROOT, f)) + ':' + r.line + '）');
      tabBad++;
    }
  }
}
console.log('  tabBar 页面 ' + tabSet.size + ' 个，违规跳转 ' + tabBad + ' 处\n');

console.log('[D] tabBar 页面必须在主包');
let tabMain = 0;
for (const p of tabSet) {
  if (!registered.has(p)) { err('tabBar 页 ' + p + ' 未在 app.json 注册'); tabMain++; }
  else if (registered.get(p) !== 'main') { err('tabBar 页 ' + p + ' 在分包内，微信不允许（须移到主包）'); tabMain++; }
}
console.log('  违规 ' + tabMain + ' 处\n');

console.log('===== 汇总 =====');
console.log('  ERROR ' + errors + ' 处，WARN ' + warnings + ' 处');
console.log(errors === 0 ? '  ✅ 全部通过' : '  ❌ 存在 ' + errors + ' 处必须修复的问题');
process.exit(errors === 0 ? 0 : 1);
