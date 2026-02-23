import re, time
from pathlib import Path

TARGET = Path("pages/fissionTask/index.js")
MARK_CALL = "[FINAL-INJECT-CALL]"
MARK_METHOD = "[FINAL-ENSURE-FISSION]"

CALL_SNIPPET = f"""
// {MARK_CALL} ensure invite+qr
try {{
  this.__finalEnsureFission && this.__finalEnsureFission();
}} catch (e) {{}}
""".strip("\n")

METHOD_BLOCK = f"""
  // {MARK_METHOD} auto ensure openid/profile/invite/qr
  __finalEnsureFission() {{
    if (this.__finalEnsuring) return;
    this.__finalEnsuring = true;

    const self = this;
    try {{ self.setData && self.setData({{ loading: true }}); }} catch (e) {{}}

    const apiBase =
      wx.getStorageSync('API_BASE') ||
      wx.getStorageSync('apiBaseUrl') ||
      ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');

    const finish = () => {{
      self.__finalEnsuring = false;
      try {{ self.setData && self.setData({{ loading: false }}); }} catch (e) {{}}
    }};

    if (!apiBase) {{
      console.log('[FINAL] API_BASE empty');
      return finish();
    }}

    const setInvite = (inv) => {{
      if (!inv) return;
      wx.setStorageSync('fissionMyInviteCode', inv);
      try {{
        self.setData && self.setData({{
          myInviteCode: inv,
          inviteCode: inv,
          fissionMyInviteCode: inv
        }});
      }} catch (e) {{}}
    }};

    const genQr = () => {{
      try {{
        if (typeof self.refreshMyQr === 'function') self.refreshMyQr();
      }} catch (e) {{}}

      // 2 秒内看见 myQrPath 就收口 loading
      let t = 0;
      const timer = setInterval(() => {{
        t++;
        try {{
          if (self.data && self.data.myQrPath) {{
            clearInterval(timer);
            finish();
          }}
        }} catch (e) {{}}
        if (t >= 10) {{
          clearInterval(timer);
          finish();
        }}
      }}, 200);
    }};

    const fetchProfile = (clientId, cb) => {{
      wx.request({{
        url: `${{apiBase}}/api/fission/profile`,
        method: 'GET',
        data: {{ clientId }},
        success: (res) => cb && cb(null, res && res.data),
        fail: (err) => cb && cb(err)
      }});
    }};

    const initFission = (clientId, cb) => {{
      wx.request({{
        url: `${{apiBase}}/api/fission/init`,
        method: 'POST',
        data: {{ clientId }},
        success: (res) => cb && cb(null, res && res.data),
        fail: (err) => cb && cb(err)
      }});
    }};

    const ensureProfile = (clientId) => {{
      console.log('[FINAL] ensure clientId=', clientId);
      try {{ self.setData && self.setData({{ clientId }}); }} catch (e) {{}}

      fetchProfile(clientId, (err, d) => {{
        if (err) {{
          console.log('[FINAL] profile fail', err);
          return finish();
        }}
        const data = d || {{}};
        const p = data.profile || {{}};

        const inv =
          p.inviteCode || p.invite_code || p.myInviteCode || p.my_invite_code ||
          data.inviteCode || data.invite_code ||
          wx.getStorageSync('fissionMyInviteCode') || '';

        if (!data.profile || !inv) {{
          console.log('[FINAL] missing invite -> init then refetch');
          initFission(clientId, () => {{
            fetchProfile(clientId, (_e2, d2) => {{
              const data2 = d2 || {{}};
              const p2 = data2.profile || {{}};
              const inv2 =
                p2.inviteCode || p2.invite_code || p2.myInviteCode || p2.my_invite_code ||
                data2.inviteCode || data2.invite_code ||
                inv || wx.getStorageSync('fissionMyInviteCode') || '';
              setInvite(inv2);
              genQr();
            }});
          }});
          return;
        }}

        setInvite(inv);
        genQr();
      }});
    }};

    const cid = wx.getStorageSync('clientId');
    if (cid) return ensureProfile(cid);

    console.log('[FINAL] no clientId -> wx.login');
    wx.login({{
      success: (r) => {{
        if (!r || !r.code) {{
          console.log('[FINAL] wx.login no code');
          return finish();
        }}
        wx.request({{
          url: `${{apiBase}}/api/wx/login`,
          method: 'POST',
          data: {{ code: r.code }},
          success: (res) => {{
            const d = (res && res.data) || {{}};
            const openid = d.openid || d.clientId || (d.data && (d.data.openid || d.data.clientId)) || '';
            console.log('[FINAL] /api/wx/login openid=', openid ? 'OK' : 'EMPTY');
            if (!openid) return finish();
            wx.setStorageSync('clientId', openid);
            ensureProfile(openid);
          }},
          fail: (e) => {{
            console.log('[FINAL] /api/wx/login fail', e);
            finish();
          }}
        }});
      }},
      fail: (e) => {{
        console.log('[FINAL] wx.login fail', e);
        finish();
      }}
    }});
  }},
""".strip("\n")

def read_text(p: Path):
    b = p.read_bytes()
    bom = b.startswith(b'\xef\xbb\xbf')
    return b.decode('utf-8-sig'), bom

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
            if esc: esc = False; i += 1; continue
            if ch == '\\': esc = True; i += 1; continue
            if in_s and ch == "'": in_s = False
            elif in_d and ch == '"': in_d = False
            elif in_t and ch == '`': in_t = False
            i += 1; continue
        if ch == '/' and nxt == '/': in_lc = True; i += 2; continue
        if ch == '/' and nxt == '*': in_bc = True; i += 2; continue
        if ch == "'": in_s = True; i += 1; continue
        if ch == '"': in_d = True; i += 1; continue
        if ch == '`': in_t = True; i += 1; continue
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0: return i
        i += 1
    return -1

def inject_all(text: str, fn_name: str) -> str:
    # onShow: function() { ... }  OR  onShow() { ... }
    patt = rf'(^[ \t]*){fn_name}\s*:\s*function\s*\([^)]*\)\s*\{{|(^[ \t]*){fn_name}\s*\([^)]*\)\s*\{{'
    matches = list(re.finditer(patt, text, re.M))
    if not matches:
        return text

    # 从后往前插，避免索引偏移
    for m in reversed(matches):
        open_brace = m.end() - 1
        close_brace = find_matching_brace(text, open_brace)
        if close_brace < 0:
            continue
        block = text[open_brace:close_brace]
        if MARK_CALL in block:
            continue
        indent = (m.group(1) or m.group(2) or "")
        inner = indent + "  "
        insert = "\n" + inner + CALL_SNIPPET.replace("\n", "\n"+inner) + "\n" + indent
        text = text[:close_brace] + insert + text[close_brace:]
    return text

def ensure_method(text: str) -> str:
    if MARK_METHOD in text or "__finalEnsureFission" in text:
        return text
    end_idx = text.rfind("});")
    if end_idx < 0:
        return text
    before = text[:end_idx].rstrip()
    need_comma = (len(before) > 0 and before[-1] != ',')
    insert = ""
    if need_comma:
        insert += ",\n"
    insert += METHOD_BLOCK + "\n"
    return text[:end_idx] + insert + text[end_idx:]

def main():
    if not TARGET.exists():
        print("[ERROR] not found:", TARGET); return

    text, bom = read_text(TARGET)
    bak = TARGET.with_suffix(TARGET.suffix + f".bak_{time.strftime('%Y%m%d_%H%M%S')}")
    bak.write_bytes(TARGET.read_bytes())

    text = ensure_method(text)
    text = inject_all(text, "onLoad")
    text = inject_all(text, "onShow")

    write_text(TARGET, text, bom)
    print("[PATCHED]", TARGET, "backup=", bak.name)

if __name__ == "__main__":
    main()
