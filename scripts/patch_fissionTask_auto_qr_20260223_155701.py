import re, time
from pathlib import Path

MARKER = "[PATCH-QR-AUTO]"
TARGET = Path("pages/fissionTask/index.js")

INJECT = r"""
// [PATCH-QR-AUTO] 进入页自动生成我的二维码（已有邀请码才生成）
try {
  const invite = (this.data && this.data.myInviteCode) || wx.getStorageSync('fissionMyInviteCode') || '';
  if (invite) {
    if (!this.data.myInviteCode && this.setData) this.setData({ myInviteCode: invite });
    if (typeof this.refreshMyQr === 'function') this.refreshMyQr();
  }
} catch (e) {}
""".strip("\n")

def read_text(p: Path):
    b = p.read_bytes()
    bom = b.startswith(b'\xef\xbb\xbf')
    text = b.decode('utf-8-sig')
    return text, bom

def write_text(p: Path, text: str, bom: bool):
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
            if ch == '\n': in_lc = False
            i += 1; continue
        if in_bc:
            if ch == '*' and nxt == '/':
                in_bc = False; i += 2; continue
            i += 1; continue
        if in_s or in_d or in_t:
            if esc:
                esc = False; i += 1; continue
            if ch == '\\':
                esc = True; i += 1; continue
            if in_s and ch == "'": in_s = False
            elif in_d and ch == '"': in_d = False
            elif in_t and ch == '`': in_t = False
            i += 1; continue
        if ch == '/' and nxt == '/':
            in_lc = True; i += 2; continue
        if ch == '/' and nxt == '*':
            in_bc = True; i += 2; continue
        if ch == "'": in_s = True; i += 1; continue
        if ch == '"': in_d = True; i += 1; continue
        if ch == '`': in_t = True; i += 1; continue
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0: return i
        i += 1
    return -1

def patch_onshow(text: str):
    if MARKER in text:
        return text, False
    m = re.search(r'(^[ \t]*)onShow\s*:\s*function\s*\([^)]*\)\s*\{|(^[ \t]*)onShow\s*\([^)]*\)\s*\{', text, re.M)
    if not m:
        return text, False
    open_brace = m.end() - 1
    close_brace = find_matching_brace(text, open_brace)
    if close_brace < 0:
        return text, False
    indent = m.group(1) or m.group(2) or ""
    inner = indent + "  "
    block = "\n" + inner + INJECT.replace("\n", "\n"+inner) + "\n" + indent
    return text[:close_brace] + block + text[close_brace:], True

def main():
    if not TARGET.exists():
        print("[ERROR] not found:", TARGET)
        return
    text, bom = read_text(TARGET)
    new_text, ok = patch_onshow(text)
    if not ok:
        print("[ERROR] onShow not found or parse failed")
        return
    if new_text == text:
        print("[OK] no change")
        return
    bak = TARGET.with_suffix(TARGET.suffix + f".bak_{time.strftime('%Y%m%d_%H%M%S')}")
    bak.write_bytes(TARGET.read_bytes())
    write_text(TARGET, new_text, bom)
    print("[PATCHED]", TARGET, "backup=", bak.name)

if __name__ == "__main__":
    main()
