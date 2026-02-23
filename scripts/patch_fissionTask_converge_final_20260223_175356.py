import time
from pathlib import Path

TARGET = Path("pages/fissionTask/index.js")

BEGIN = "// [CLEAN-FISSIONTASK-FINAL-BEGIN]"
END   = "// [CLEAN-FISSIONTASK-FINAL-END]"

FINAL_BLOCK = f"""{BEGIN}
  // 说明：本块是 fissionTask 的“唯一生效入口”，后续只维护这里即可。
  //      onShow/onHide/onUnload 统一收口；确保 openid→profile→invite→qr 自动完成。

  __finalEnsureFission() {{
    if (this.__finalEnsuring) return;
    this.__finalEnsuring = true;

    const self = this;

    const apiBase =
      wx.getStorageSync('API_BASE') ||
      wx.getStorageSync('apiBaseUrl') ||
      ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');

    const finish = () => {{
      self.__finalEnsuring = false;
      try {{ self.setData && self.setData({{ loading: false }}); }} catch (e) {{}}
    }};

    if (!apiBase) return finish();

    try {{ self.setData && self.setData({{ loading: true }}); }} catch (e) {{}}

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

    const syncRewards = (total) => {{
      try {{
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

        try {{
          self.setData && self.setData({{
            userRights: rights,
            freeCalcTimes: Number(rights.freeCalcTimes || 0) || currentFree,
            membershipName: rights.membershipName || ''
          }});
        }} catch (e) {{}}
      }} catch (e) {{}}
    }};

    const genQr = () => {{
      try {{
        if (typeof self.refreshMyQr === 'function') self.refreshMyQr();
      }} catch (e) {{}}

      // 2 秒内看到 myQrPath 就收口；否则超时也收口
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
      try {{ self.setData && self.setData({{ clientId }}); }} catch (e) {{}}

      fetchProfile(clientId, (err, d) => {{
        if (err) return finish();

        const data = d || {{}};
        const p = data.profile || {{}};

        const total = Number((data.total_reward_times ?? p.total_reward_times ?? 0)) || 0;
        syncRewards(total);

        const inv =
          p.inviteCode || p.invite_code || p.myInviteCode || p.my_invite_code ||
          data.inviteCode || data.invite_code ||
          wx.getStorageSync('fissionMyInviteCode') || '';

        if (!data.profile || !inv) {{
          initFission(clientId, () => {{
            fetchProfile(clientId, (_e2, d2) => {{
              const data2 = d2 || {{}};
              const p2 = data2.profile || {{}};
              const total2 = Number((data2.total_reward_times ?? p2.total_reward_times ?? total)) || total;
              syncRewards(total2);

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

    wx.login({{
      success: (r) => {{
        if (!r || !r.code) return finish();
        wx.request({{
          url: `${{apiBase}}/api/wx/login`,
          method: 'POST',
          data: {{ code: r.code }},
          success: (res) => {{
            const d = (res && res.data) || {{}};
            const openid = d.openid || d.clientId || (d.data && (d.data.openid || d.data.clientId)) || '';
            if (!openid) return finish();
            wx.setStorageSync('clientId', openid);
            ensureProfile(openid);
          }},
          fail: () => finish()
        }});
      }},
      fail: () => finish()
    }});
  }},

  // 唯一生效入口：每次进入页都确保邀请码+二维码+权益同步
  onShow() {{
    try {{ if (typeof this.startRightsAutoSync === 'function') this.startRightsAutoSync(); }} catch (e) {{}}
    try {{ this.__finalEnsureFission && this.__finalEnsureFission(); }} catch (e) {{}}
  }},

  onHide() {{
    try {{ this.stopRightsAutoSync && this.stopRightsAutoSync(); }} catch (e) {{}}
  }},

  onUnload() {{
    try {{ this.stopRightsAutoSync && this.stopRightsAutoSync(); }} catch (e) {{}}
  }},
{END}
"""

def read_text(p: Path):
    b = p.read_bytes()
    bom = b.startswith(b'\xef\xbb\xbf')
    return b.decode('utf-8-sig'), bom

def write_text(p: Path, text: str, bom: bool):
    data = text.encode('utf-8')
    if bom:
        data = b'\xef\xbb\xbf' + data
    p.write_bytes(data)

def main():
    if not TARGET.exists():
        print("[ERROR] not found:", TARGET)
        return

    text, bom = read_text(TARGET)

    bak = TARGET.with_suffix(TARGET.suffix + f".bak_{time.strftime('%Y%m%d_%H%M%S')}")
    bak.write_bytes(TARGET.read_bytes())

    if BEGIN in text and END in text:
        # replace existing final block
        pre = text.split(BEGIN)[0]
        post = text.split(END)[1]
        text = pre + FINAL_BLOCK + post
    else:
        # insert before last "});"
        end_idx = text.rfind("});")
        if end_idx < 0:
            print("[ERROR] cannot find Page end '});'")
            return
        before = text[:end_idx].rstrip()
        need_comma = (len(before) > 0 and before[-1] != ',')
        insert = ("\n," if need_comma else "\n") + FINAL_BLOCK + "\n"
        text = text[:end_idx] + insert + text[end_idx:]

    write_text(TARGET, text, bom)
    print("[PATCHED] converge final block added. backup=", bak.name)

if __name__ == "__main__":
    main()
