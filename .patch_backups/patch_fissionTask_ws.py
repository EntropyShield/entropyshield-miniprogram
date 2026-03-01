import argparse, os, re, shutil, sys, datetime

def read_text(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()

def write_text(p, s):
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)

def backup_file(src, bk_dir):
    os.makedirs(bk_dir, exist_ok=True)
    dst = os.path.join(bk_dir, os.path.basename(src))
    shutil.copy2(src, dst)
    return dst

def patch_wxml(wxml_path):
    # 极简 WXML：排除 WXML 语法/表达式导致白屏
    content = """<!-- pages/fissionTask/index.wxml -->
<view style="padding:24rpx;">
  <view style="font-size:34rpx;font-weight:600;">裂变任务中心</view>
  <view style="margin-top:12rpx;color:#666;">{{statusText}}</view>

  <view style="margin-top:12rpx;word-break:break-all;">clientId={{clientId}}</view>
  <view style="margin-top:12rpx;">myInviteCode={{myInviteCode}}</view>
  <view style="margin-top:12rpx;">invitedByCode={{invitedByCode}}</view>
  <view style="margin-top:12rpx;">totalRewardTimes={{totalRewardTimes}}</view>
</view>
"""
    write_text(wxml_path, content)

def patch_js(js_path):
    s = read_text(js_path)

    marker = "[PATCH-WS-ONLOAD]"
    if marker in s:
        return False, "index.js 已有补丁标记，跳过重复注入"

    # 兼容 3 种写法：async onLoad(options) { / onLoad(options) { / onLoad: function(options) {
    patterns = [
        r'(^[ \t]*)(async\s+)?onLoad\s*\(\s*options\s*\)\s*\{',
        r'(^[ \t]*)onLoad\s*:\s*function\s*\(\s*options\s*\)\s*\{',
    ]

    m = None
    pat_used = None
    for pat in patterns:
        m = re.search(pat, s, flags=re.M)
        if m:
            pat_used = pat
            break

    if not m:
        return False, "未找到 onLoad(options) 定义，未修改 index.js"

    indent = m.group(1) or ""
    indent2 = indent + "  "  # 两空格缩进

    inject = (
        f"\n{indent2}// {marker} debug signals\n"
        f"{indent2}console.log('[fissionTask] onLoad', options)\n"
        f"{indent2}wx.showToast({{ title: 'fissionTask onLoad', icon: 'none', duration: 1500 }})\n"
    )

    # 插入点：匹配到的 { 之后
    insert_pos = m.end()
    s2 = s[:insert_pos] + inject + s[insert_pos:]
    write_text(js_path, s2)
    return True, f"index.js 已注入 onLoad 信号（pattern={pat_used})"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proj", required=True)
    args = ap.parse_args()

    proj = args.proj
    js_path = os.path.join(proj, "pages", "fissionTask", "index.js")
    wxml_path = os.path.join(proj, "pages", "fissionTask", "index.wxml")

    if not os.path.isfile(js_path):
        print("ERROR: 找不到", js_path)
        sys.exit(1)
    if not os.path.isfile(wxml_path):
        print("ERROR: 找不到", wxml_path)
        sys.exit(1)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    bk_dir = os.path.join(proj, ".patch_backups", f"fissionTask_ws_{ts}")
    os.makedirs(bk_dir, exist_ok=True)

    bk_js = backup_file(js_path, bk_dir)
    bk_wxml = backup_file(wxml_path, bk_dir)

    patch_wxml(wxml_path)
    changed, msg = patch_js(js_path)

    print("OK: 已完成补丁")
    print("备份目录:", bk_dir)
    print("备份文件:", bk_js)
    print("备份文件:", bk_wxml)
    print(msg)

if __name__ == "__main__":
    main()
