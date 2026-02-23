import re, time
from pathlib import Path

TARGET = Path("pages/fissionTask/index.js")

FINAL = r"""
console.log('[FINAL] fissionTask onShow start');

var self = this;
try { self.setData && self.setData({ loading: true }); } catch (e) {}

var apiBase =
  wx.getStorageSync('API_BASE') ||
  wx.getStorageSync('apiBaseUrl') ||
  ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');

if (!apiBase) {
  console.log('[FINAL] API_BASE empty');
  try { self.setData && self.setData({ loading: false }); } catch (e) {}
  return;
}

function stopLoadingSoon() {
  var t = 0;
  var timer = setInterval(function() {
    t++;
    try {
      if (self.data && self.data.myQrPath) {
        clearInterval(timer);
        self.setData && self.setData({ loading: false });
      }
    } catch (e) {}
    if (t >= 10) {
      clearInterval(timer);
      try { self.setData && self.setData({ loading: false }); } catch (e) {}
    }
  }, 200);
}

function syncRewards(total) {
  try {
    var RIGHTS_KEY = 'userRights';
    var SYNC_KEY = 'fission_total_reward_times_synced';
    var rights = wx.getStorageSync(RIGHTS_KEY) || {};
    var currentFree = Number(rights.freeCalcTimes || 0) || 0;
    var lastSynced = Number(wx.getStorageSync(SYNC_KEY) || 0) || 0;

    if (lastSynced === 0 && currentFree > 0) {
      wx.setStorageSync(SYNC_KEY, total);
      lastSynced = total;
    }

    var delta = total - lastSynced;
    if (delta > 0) {
      rights.freeCalcTimes = currentFree + delta;
      if (!rights.membershipName) rights.membershipName = 'FREE';
      wx.setStorageSync(RIGHTS_KEY, rights);
      wx.setStorageSync(SYNC_KEY, total);
    }

    try { self.setData && self.setData({ userRights: rights, freeCalcTimes: Number(rights.freeCalcTimes || 0) || currentFree, membershipName: rights.membershipName || '' }); } catch (e) {}
  } catch (e) {}
}

function setInvite(inv) {
  if (!inv) return;
  wx.setStorageSync('fissionMyInviteCode', inv);
  try { self.setData && self.setData({ myInviteCode: inv, inviteCode: inv, fissionMyInviteCode: inv }); } catch (e) {}
}

function genQr() {
  try {
    if (typeof self.refreshMyQr === 'function') self.refreshMyQr();
  } catch (e) {}
  stopLoadingSoon();
}

function fetchProfile(clientId, cb) {
  wx.request({
    url: apiBase + '/api/fission/profile',
    method: 'GET',
    data: { clientId: clientId },
    success: function(res) { cb && cb(null, res && res.data); },
    fail: function(err) { cb && cb(err); }
  });
}

function initFission(clientId, cb) {
  wx.request({
    url: apiBase + '/api/fission/init',
    method: 'POST',
    data: { clientId: clientId },
    success: function(res) { cb && cb(null, res && res.data); },
    fail: function(err) { cb && cb(err); }
  });
}

function ensureAll(clientId) {
  console.log('[FINAL] ensure clientId=', clientId);
  try { self.setData && self.setData({ clientId: clientId }); } catch (e) {}

  fetchProfile(clientId, function(err, d) {
    if (err) {
      console.log('[FINAL] profile request fail', err);
      try { self.setData && self.setData({ loading: false }); } catch (e) {}
      return;
    }

    var data = d || {};
    var p = data.profile || {};
    var total = Number(data.total_reward_times ?? p.total_reward_times ?? 0) || 0;
    syncRewards(total);

    var inv = p.inviteCode || p.invite_code || p.myInviteCode || p.my_invite_code || data.inviteCode || data.invite_code || wx.getStorageSync('fissionMyInviteCode') || '';
    if (!data.profile || !inv) {
      console.log('[FINAL] profile missing invite -> init then refetch');
      initFission(clientId, function() {
        fetchProfile(clientId, function(_e2, d2) {
          var data2 = d2 || {};
          var p2 = data2.profile || {};
          var total2 = Number(data2.total_reward_times ?? p2.total_reward_times ?? total) || total;
          syncRewards(total2);

          var inv2 = p2.inviteCode || p2.invite_code || p2.myInviteCode || p2.my_invite_code || data2.inviteCode || data2.invite_code || inv || wx.getStorageSync('fissionMyInviteCode') || '';
          setInvite(inv2);
          genQr();
        });
      });
      return;
    }

    setInvite(inv);
    genQr();
  });
}

var cid = wx.getStorageSync('clientId');
if (cid) {
  ensureAll(cid);
  return;
}

console.log('[FINAL] no clientId, do wx.login');
wx.login({
  success: function(r) {
    if (!r || !r.code) {
      console.log('[FINAL] wx.login no code');
      try { self.setData && self.setData({ loading: false }); } catch (e) {}
      return;
    }
    wx.request({
      url: apiBase + '/api/wx/login',
      method: 'POST',
      data: { code: r.code },
      success: function(res) {
        var d = (res && res.data) || {};
        var openid = d.openid || d.clientId || (d.data && (d.data.openid || d.data.clientId)) || '';
        console.log('[FINAL] /api/wx/login openid=', openid ? 'OK' : 'EMPTY');
        if (!openid) {
          try { self.setData && self.setData({ loading: false }); } catch (e) {}
          return;
        }
        wx.setStorageSync('clientId', openid);
        ensureAll(openid);
      },
      fail: function(e) {
        console.log('[FINAL] /api/wx/login fail', e);
        try { self.setData && self.setData({ loading: false }); } catch (e2) {}
      }
    });
  },
  fail: function(e) {
    console.log('[FINAL] wx.login fail', e);
    try { self.setData && self.setData({ loading: false }); } catch (e2) {}
  }
});
""".strip("\n")

def read_text(p: Path):
    b = p.read_bytes()
    bom = b.startswith(b'\xef\xbb\xbf')
    return b.decode('utf-8-sig'), bom

def write_text(p: Path, text: str, bom: bool):
    data = text.encode('utf-8')
    if bom: data = b'\xef\xbb\xbf' + data
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

def replace_onshow_body(text: str):
    m = re.search(r'(^[ \t]*)onShow\s*:\s*function\s*\([^)]*\)\s*\{|(^[ \t]*)onShow\s*\([^)]*\)\s*\{', text, re.M)
    if not m: return text, False
    indent = m.group(1) or m.group(2) or ""
    open_brace = m.end() - 1
    close_brace = find_matching_brace(text, open_brace)
    if close_brace < 0: return text, False
    inner = indent + "  "
    body = "\n" + inner + FINAL.replace("\n", "\n"+inner) + "\n" + indent
    return text[:open_brace+1] + body + text[close_brace:], True

def main():
    if not TARGET.exists():
        print("[ERROR] not found:", TARGET); return
    text, bom = read_text(TARGET)
    bak = TARGET.with_suffix(TARGET.suffix + f".bak_{time.strftime('%Y%m%d_%H%M%S')}")
    bak.write_bytes(TARGET.read_bytes())
    new_text, ok = replace_onshow_body(text)
    if not ok:
        print("[ERROR] onShow not found"); return
    write_text(TARGET, new_text, bom)
    print("[PATCHED]", TARGET, "backup=", bak.name)

if __name__ == "__main__":
    main()
