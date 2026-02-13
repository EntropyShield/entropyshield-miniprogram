const fs = require('fs');
const path = require('path');

const app = JSON.parse(fs.readFileSync('app.json','utf8'));
const appPages = new Set((app.pages||[]).map(s=>String(s).trim()));

function walk(dir){
  const out=[];
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(js|wxml|json)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

// 只抓真正的页面路径：/pages/**/index（避免误抓 /pages/xxx/index.js 这种）
const files = walk('./pages');
const re = /\/pages\/[A-Za-z0-9_\/-]+\/index/g;

const refs = new Set();
for (const f of files){
  const s = fs.readFileSync(f,'utf8');
  const m = s.match(re);
  if (m) m.forEach(x=>refs.add(x.replace(/^\//,''))); // 去掉开头 /
}

const missing = [...refs].filter(p=>!appPages.has(p)).sort();
console.log('---- Missing in app.json pages[] ----');
console.log(missing.length ? missing.join('\n') : '(none)');
