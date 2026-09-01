#!/usr/bin/env node
/**
 * 临时检查：核心页「渲染层闭环」—— wxml 事件绑定的方法，js 里是否真的定义了。
 * 断链表现：点击无任何反应（不报错、不跳转），是展示层最隐蔽的坑。
 * 放项目外运行，不污染 miniprogram-3。
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'F:/熵盾公司/熵盾公司/3熵盾小程序/miniprogram-3';

// 事件绑定属性：bindtap / bind:tap / catchtap / capture-bind:tap / mut-bind:tap
const EVT_RE = /\b(?:bind|catch|capture-bind|capture-catch|mut-bind)[:]?[a-zA-Z]+\s*=\s*"([^"]+)"/g;

function methodsFromWxml(file) {
  const s = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const out = new Set();
  let m;
  EVT_RE.lastIndex = 0;
  while ((m = EVT_RE.exec(s))) {
    const v = m[1].trim();
    // 只取纯方法名，跳过 {{...}} 表达式与空值
    if (!v || /[{}$]/.test(v)) continue;
    out.add(v);
  }
  return out;
}

function hasMethodInJs(jsSrc, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp('\\b' + esc + '\\s*\\('),                       // foo(   / foo: async (
    new RegExp('\\b' + esc + '\\s*:\\s*(?:async\\s+)?function'), // foo: function / foo: async function
    new RegExp('\\b' + esc + '\\s*:\\s*async\\s*\\('),          // foo: async (
    new RegExp('\\b' + esc + '\\s*=\\s*(?:async\\s*)?\\(')      // foo = ( / foo = async (
  ];
  return patterns.some((re) => re.test(jsSrc));
}

const pages = process.argv.slice(2);
let bad = 0;
for (const p of pages) {
  let wxml = path.join(ROOT, p, 'index.wxml');
  let js = path.join(ROOT, p, 'index.js');
  // 兼容页面文件直接平铺的写法（如 pkgService/course/detail.wxml，而非 detail/index.wxml）
  if (!fs.existsSync(wxml) || !fs.existsSync(js)) {
    const w2 = path.join(ROOT, p + '.wxml');
    const j2 = path.join(ROOT, p + '.js');
    if (fs.existsSync(w2) && fs.existsSync(j2)) { wxml = w2; js = j2; }
  }
  if (!fs.existsSync(wxml) || !fs.existsSync(js)) {
    console.log('[跳过] ' + p + '（wxml 或 js 不存在）');
    continue;
  }
  const jsSrc = fs.readFileSync(js, 'utf8');
  const ms = [...methodsFromWxml(wxml)].sort();
  const missing = ms.filter((n) => !hasMethodInJs(jsSrc, n));
  console.log('--- ' + p + ' ---');
  console.log('  绑定方法 ' + ms.length + ' 个，未定义 ' + missing.length + ' 个');
  missing.forEach((n) => { console.log('    ❌ ' + n); bad++; });
}
console.log('\n合计断链 ' + bad + ' 处');
process.exit(bad ? 1 : 0);
