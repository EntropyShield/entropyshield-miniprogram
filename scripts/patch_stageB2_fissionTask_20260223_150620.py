import re, time
from pathlib import Path

MARKER = "[PATCH-20260223-B2]"
TARGET = Path("pages/fissionTask/index.js")

METHOD_BLOCK = f"""
  // ==============================
  // {MARKER} fissionTask 权益短轮询（15s）
  // ==============================
  startRightsAutoSync() {{
    if (this._rightsTimer) return;
    this._rightsTimer = setInterval(() => {{
      try {{
        const apiBase =
          wx.getStorageSync('API_BASE') ||
          wx.getStorageSync('apiBaseUrl') ||
          ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');
        const clientId = wx.getStorageSync('clientId');
        if (!apiBase || !clientId) return;

        wx.request({{
          url: `${{apiBase}}/api/fission/profile`,
          method: 'GET',
          data: {{ clientId }},
          success: (res) => {{
            const d = res && res.data;
            if (!d || !d.ok) return;

            const total = Number((d.total_reward_times ?? (d.profile && d.profile.total_reward_times) ?? 0)) || 0;

            const RIGHTS_KEY = 'userRights';
            const SYNC_KEY = 'fission_total_reward_times_synced';

            const rights = wx.getStorageSync(RIGHTS_KEY) || {{}};
            const currentFree = Number(rights.freeCalcTimes || 0) || 0;
            let lastSynced = Number(wx.getStorageSync(SYNC_KEY) || 0) || 0;

            // 初始化对齐：避免重复加
            if (lastSynced === 0 && currentFree > 0) {{
              wx.setStorageSync(SYNC_KEY, total);
              lastSynced = total;
            }}

            const delta = total - lastSynced;
            if (delta > 0) {{
              rights.freeCalcTimes = currentFree + delta;
              if (!rights.membershipName) rights.membershipName = 'FREE';
              wx.setStorageSync(RIGHTS_KEY, rights);
              wx.setStorageSync(SYNC_KEY, total);
            }}

            // 无论是否新增，都刷新 UI
            if (this && this.setData) {{
              this.setData({{
                userRights: rights,
                freeCalcTimes: Number(rights.freeCalcTimes || 0) || currentFree,
                membershipName: rights.membershipName || ''
              }});
            }}
          }}
        }});
      }} catch (e) {{}}
    }}, 15000);
  }},

  stopRightsAutoSync() {{
    if (this._rightsTimer) {{
      clearInterval(this._rightsTimer);
      this._rightsTimer = null;
    }}
  }},
"""

def read_text_keep_bom(p: Path):
    b = p.read_bytes()
    bom = b.startswith(b'\xef\xbb\xbf')
    text = b.decode('utf-8-sig')
    return text, bom

def write_text_keep_bom(p: Path, text: str, bom: bool):
    data = text.encode('utf-8')
    if bom:
        data = b'\xef\xbb\xbf' + data
    p.write_bytes(data)

def find_matching_brace(text: str, open_idx: int) -> int:
    i, n = open_idx, len(text)
    depth = 0
    in_s = in_d = in_t = False
    in_lc = in_bc = False
    esc = False
    while i < n:
        ch = text[i]
        nxt = text[i+1] if i+1 < n else ''

        if in_lc:
            if ch == '\n':
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
            if ch == '\\':
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

        if ch == '/' and nxt == '/':
            in_lc = True
            i += 2
            continue
        if ch == '/' and nxt == '*':
            in_bc = True
            i += 2
            continue

        if ch == "'":
            in_s = True; i += 1; continue
        if ch == '"':
            in_d = True; i += 1; continue
        if ch == '`':
            in_t = True; i += 1; continue

        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def inject_into_fn(text: str, fn_name: str, inject_line: str) -> str:
    # onShow: function() {  或  onShow() {
    m = re.search(rf'(^[ \t]*){fn_name}\s*:\s*function\s*\([^)]*\)\s*\{{|(^[ \t]*){fn_name}\s*\([^)]*\)\s*\{{', text, re.M)
    if not m:
        return text, False

    indent = m.group(1) or m.group(2) or ""
    open_brace = m.end() - 1
    close_brace = find_matching_brace(text, open_brace)
    if close_brace < 0:
        return text, False

    # 已经插过就不再插
    if MARKER in text[open_brace:close_brace]:
        return text, True

    inner = indent + ("  ")
    block = "\n" + inner + inject_line.replace("\n", "\n" + inner) + "\n" + indent
    new_text = text[:close_brace] + block + text[close_brace:]
    return new_text, True

def ensure_method(text: str, method_stub: str) -> str:
    # 插入到 Page({...}) 结束前
    end_idx = text.rfind("});")
    if end_idx < 0:
        return text

    before = text[:end_idx].rstrip()
    need_comma = len(before) > 0 and before[-1] not in [',', '{']
    insert = ""
    if need_comma:
        insert += ",\n"
    insert += method_stub + "\n"
    return text[:end_idx] + insert + text[end_idx:]

def main():
    if not TARGET.exists():
        print(f"[ERROR] not found: {TARGET}")
        return

    text, bom = read_text_keep_bom(TARGET)

    if MARKER in text and "startRightsAutoSync" in text:
        print("[OK] already patched, skip")
        return

    bak = TARGET.with_suffix(TARGET.suffix + f".bak_{time.strftime('%Y%m%d_%H%M%S')}")
    bak.write_bytes(TARGET.read_bytes())

    # 1) 确保方法存在（start/stop）
    if "startRightsAutoSync" not in text:
        text = ensure_method(text, METHOD_BLOCK.rstrip())

    # 2) onShow 注入 start
    text, ok_show = inject_into_fn(
        text, "onShow",
        f"// {MARKER}\nthis.startRightsAutoSync && this.startRightsAutoSync();"
    )

    # 3) onHide 注入 stop；若不存在则创建
    text2, ok_hide = inject_into_fn(
        text, "onHide",
        f"// {MARKER}\nthis.stopRightsAutoSync && this.stopRightsAutoSync();"
    )
    text = text2
    if not ok_hide and "onHide" not in text:
        text = ensure_method(text, f"""
  // {MARKER} stop onHide
  onHide() {{
    this.stopRightsAutoSync && this.stopRightsAutoSync();
  }},
""".rstrip())

    # 4) onUnload 注入 stop；若不存在则创建
    text2, ok_unload = inject_into_fn(
        text, "onUnload",
        f"// {MARKER}\nthis.stopRightsAutoSync && this.stopRightsAutoSync();"
    )
    text = text2
    if not ok_unload and "onUnload" not in text:
        text = ensure_method(text, f"""
  // {MARKER} stop onUnload
  onUnload() {{
    this.stopRightsAutoSync && this.stopRightsAutoSync();
  }},
""".rstrip())

    write_text_keep_bom(TARGET, text, bom)
    print(f"[PATCHED] {TARGET} (backup: {bak.name})")

if __name__ == "__main__":
    main()
