import re, sys, time
from pathlib import Path

MARKER = "[PATCH-20260223-B1]"
SYNC_KEY = "fission_total_reward_times_synced"
RIGHTS_KEY = "userRights"

TARGETS = [
    ("pages/fissionTask/index.js", "fissionTask"),
    ("pages/profile/index.js", "profile"),
    ("pages/riskCalculator/index.js", "riskCalculator"),
]

PATCH_LINES = [
    f"// {MARKER} 权益实时刷新：onShow 拉取 /api/fission/profile 并增量同步 freeCalcTimes",
    "try {",
    "  const apiBase =",
    "    wx.getStorageSync('API_BASE') ||",
    "    wx.getStorageSync('apiBaseUrl') ||",
    "    ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');",
    "  const clientId = wx.getStorageSync('clientId');",
    "  if (apiBase && clientId) {",
    "    wx.request({",
    "      url: `${apiBase}/api/fission/profile`,",
    "      method: 'GET',",
    "      data: { clientId },",
    "      success: (res) => {",
    "        const d = res && res.data;",
    "        if (!d || !d.ok) return;",
    "        const total = Number((d.total_reward_times ?? (d.profile && d.profile.total_reward_times) ?? 0)) || 0;",
    "",
    f"        const rights = wx.getStorageSync('{RIGHTS_KEY}') || {{}};",
    "        const currentFree = Number(rights.freeCalcTimes || 0) || 0;",
    f"        let lastSynced = Number(wx.getStorageSync('{SYNC_KEY}') || 0) || 0;",
    "",
    "        // 初始化：如果之前已有 freeCalcTimes，但没记录 lastSynced，则直接对齐到服务端，避免重复加",
    "        if (lastSynced === 0 && currentFree > 0) {",
    f"          wx.setStorageSync('{SYNC_KEY}', total);",
    "          lastSynced = total;",
    "        }",
    "",
    "        const delta = total - lastSynced;",
    "        if (delta > 0) {",
    "          rights.freeCalcTimes = currentFree + delta;",
    "          if (!rights.membershipName) rights.membershipName = 'FREE';",
    f"          wx.setStorageSync('{RIGHTS_KEY}', rights);",
    f"          wx.setStorageSync('{SYNC_KEY}', total);",
    "        }",
    "",
    "        // 无论是否新增，都刷新一下 UI（不影响你现有骨架）",
    "        if (this && this.setData) {",
    "          this.setData({",
    "            userRights: rights,",
    "            freeCalcTimes: Number(rights.freeCalcTimes || 0) || currentFree,",
    "            membershipName: rights.membershipName || ''",
    "          });",
    "        }",
    "      }",
    "    });",
    "  }",
    "} catch (e) {}",
]

def read_text_keep_bom(p: Path):
    b = p.read_bytes()
    bom = b.startswith(b'\\xef\\xbb\\xbf')
    text = b.decode('utf-8-sig')
    return text, bom

def write_text_keep_bom(p: Path, text: str, bom: bool):
    data = text.encode('utf-8')
    if bom:
        data = b'\\xef\\xbb\\xbf' + data
    p.write_bytes(data)

def find_matching_brace(text: str, open_idx: int) -> int:
    # 简易 JS 状态机：忽略字符串与注释内的花括号
    i = open_idx
    n = len(text)
    depth = 0
    in_s = in_d = in_t = False
    in_lc = in_bc = False
    esc = False

    while i < n:
        ch = text[i]
        nxt = text[i+1] if i+1 < n else ''

        if in_lc:
            if ch == '\\n':
                in_lc = False
            i += 1
            continue
        if in_bc:
            if ch == '*' and nxt == '/':
                in_bc = False
                i += 2
                continue
            i += 1
            continue

        if in_s or in_d or in_t:
            if esc:
                esc = False
                i += 1
                continue
            if ch == '\\\\':
                esc = True
                i += 1
                continue
            if in_s and ch == "'":
                in_s = False
            elif in_d and ch == '"':
                in_d = False
            elif in_t and ch == '`':
                in_t = False
            i += 1
            continue

        # 进入注释
        if ch == '/' and nxt == '/':
            in_lc = True
            i += 2
            continue
        if ch == '/' and nxt == '*':
            in_bc = True
            i += 2
            continue

        # 进入字符串
        if ch == "'":
            in_s = True
            i += 1
            continue
        if ch == '"':
            in_d = True
            i += 1
            continue
        if ch == '`':
            in_t = True
            i += 1
            continue

        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1

    return -1

def patch_onshow(text: str) -> str:
    if MARKER in text:
        return text

    # 匹配 onShow 两种写法
    m = re.search(r'(^[ \\t]*)onShow\\s*:\\s*function\\s*\\([^)]*\\)\\s*\\{|(^[ \\t]*)onShow\\s*\\([^)]*\\)\\s*\\{', text, re.M)
    if not m:
        # 没有 onShow：在 Page({ ... }) 末尾补一个
        page_i = text.find('Page(')
        if page_i < 0:
            return text
        end_i = text.rfind('});')
        if end_i < 0:
            return text

        # 判断末尾是否需要补逗号
        before = text[:end_i].rstrip()
        need_comma = (len(before) > 0 and before[-1] != ',')
        insert = ""
        if need_comma:
            insert += ",\n"
        insert += "  onShow() {\n"
        insert += "    " + ("\\n    ".join(PATCH_LINES)) + "\n"
        insert += "  }\n"
        return text[:end_i] + insert + text[end_i:]

    indent = m.group(1) or m.group(2) or ""
    open_brace = m.end() - 1
    close_brace = find_matching_brace(text, open_brace)
    if close_brace < 0:
        return text

    inner = indent + ("\t" if "\t" in indent else "  ")
    block = "\n" + inner + ("\n" + inner).join(PATCH_LINES) + "\n" + indent

    # 在 onShow 结束前插入
    return text[:close_brace] + block + text[close_brace:]

def main():
    root = Path.cwd()
    changed = 0
    for rel, name in TARGETS:
        p = root / rel
        if not p.exists():
            print(f"[SKIP] not found: {rel}")
            continue

        text, bom = read_text_keep_bom(p)
        new_text = patch_onshow(text)

        if new_text == text:
            print(f"[OK] no change: {rel}")
            continue

        bak = p.with_suffix(p.suffix + f".bak_{time.strftime('%Y%m%d_%H%M%S')}")
        bak.write_bytes(p.read_bytes())
        write_text_keep_bom(p, new_text, bom)
        changed += 1
        print(f"[PATCHED] {rel}  (backup: {bak.name})")

    print(f"Done. patched_files={changed}")

if __name__ == "__main__":
    main()
