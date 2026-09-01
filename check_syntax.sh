#!/usr/bin/env bash
# 熵盾小程序 · 全库语法体检脚本
# 用法：进入 miniprogram-3 目录后执行  bash check_syntax.sh
# 作用：① node --check 全部 .js  ② JSON.parse 全部 .json
#       ③ 页面引用完整性 check-refs.js（app.json 注册页文件是否齐全 / 跳转是否悬挂 / tabBar 跳转方式是否合规）
#       只列 FAIL 与 ERROR 并汇总
set -u

# 优先用 managed node（固定路径），找不到则回退系统 node
NODE="C:/Users/qiudo/.workbuddy/binaries/node/versions/22.22.2-2/node.exe"
if [ ! -x "$NODE" ]; then NODE="$(command -v node || true)"; fi
if [ -z "$NODE" ]; then echo "未找到 node，请安装或修正脚本内 NODE 路径"; exit 1; fi

echo "使用 node: $($NODE -v 2>/dev/null || echo unknown)"
echo "扫描目录: $(pwd)"
echo ""

jok=0; jfail=0
while IFS= read -r f; do
  if "$NODE" --check "$f" >/dev/null 2>&1; then jok=$((jok+1)); else echo "FAIL(JS)   $f"; jfail=$((jfail+1)); fi
done < <(find . -name "*.js" -not -path "./.git/*")

kok=0; kfail=0
while IFS= read -r f; do
  if "$NODE" -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$f" >/dev/null 2>&1; then kok=$((kok+1)); else echo "FAIL(JSON) $f"; kfail=$((kfail+1)); fi
done < <(find . -name "*.json" -not -path "./.git/*")

echo ""
echo "-------- 页面引用完整性（check-refs.js）--------"
refrc=0
if [ -f "check-refs.js" ]; then
  "$NODE" check-refs.js
  refrc=$?
else
  echo "（未找到 check-refs.js，跳过该项）"
fi

echo ""
echo "======== 结果汇总 ========"
echo "JS   : OK=$jok   FAIL=$jfail"
echo "JSON : OK=$kok   FAIL=$kfail"
if [ -f "check-refs.js" ]; then
  if [ "$refrc" -eq 0 ]; then echo "REFS : OK   （页面引用 0 悬挂 / tabBar 合规）"; else echo "REFS : FAIL （见上方 [ERROR]）"; fi
fi

if [ "$jfail" -eq 0 ] && [ "$kfail" -eq 0 ] && [ "$refrc" -eq 0 ]; then
  echo "✅ 全部通过"
  exit 0
else
  echo "❌ 存在失败项，见上方 FAIL / ERROR 列表"
  exit 1
fi
