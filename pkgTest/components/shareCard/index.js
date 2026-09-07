// pkgTest/components/shareCard/index.js
// [V2.0-C4] 分享卡 Canvas 三模板：温度卡 / 分数卡 / 挑战卡
//
// 为什么做：裂变闭环的最后一厘米。C1(被埋页复活)/C2(邀请码分享)/C3(空壳测试补完)
// 均已落地，但分享出去只是"微信截屏"，没有谈资。本组件把结果画成一张真卡片：
// 数字 + 段位 + 小程序码 + 日期，让"晒"这件事自带传播力。
//
// 设计约束：
// 1. 放 pkgTest 分包内 —— 守主包 2MB 红线（新增功能一律走分包）。
// 2. Canvas 2D（type="2d"）—— 官方推荐路径，旧版 canvas-id 已不建议新用。
// 3. 卡片必须带免责声明 —— 12 号合规报告红线，禁止出现"建议/收益承诺"措辞。
// 4. 小程序码复用既有 /api/fission/qrcode 接口（fissionTask 已在用），不另造轮子。
//
// 关键坑（已修）：
// · Canvas 2D 的 drawImage 必须等图片 onload 完成，同步写会画出空白；
// · createImage 是 canvas 对象的方法（canvas.createImage），不是 wx.createImage；
// · 小程序码拿不到时画占位框兜底，绝不让整张卡出不来。

// 画布设计尺寸（CSS px）。导出时按 pixelRatio 放大，保证高清。
const DESIGN_W = 300;
const DESIGN_H = 400;

// 设计令牌的 Canvas 版（Canvas 读不到 CSS 变量，需在此镜像；改主色时两处同改）
const T = {
  // [VI V1.0 2026-09-07] 同步设计令牌新值。canvas 不支持 var()，只能写死；
  // 改动 app.wxss 令牌时这里必须同步，否则分享卡会与 App 内配色脱节。
  bg: '#03060C',      // --es-bg（原 #0A0E14）
  card: '#07111E',    // --es-card（原 #121A26）
  line: '#4B5663',    // --es-line（原 #1E2A3A）
  green: '#00BFFF',   // Electric Blue 品牌主色，作卡片 accent（原 #00E5A0）
  greenDeep: '#006CFF', // Deep Energy Blue，作卡片 accent（原 #0F6E56）
  red: '#FF4D5E',     // --es-red 不变
  amber: '#FFB020',   // --es-amber 不变
  blue: '#006CFF',    // --es-blue（原 #1E90FF）
  txt1: '#F4F7FA',    // --es-txt-1（原 #E8EDF5）
  txt2: '#AAB4BE',    // --es-txt-2（原 #8A94A6）
  txt3: '#8E98A3',    // --es-txt-3（原 #5A6577）
};

// 三套模板
const TEMPLATES = {
  // 分数卡：五种测试结果共用（loss/market/danger/emotion/ability）
  // accentSoft = accent 的淡化版，用于渐变终点与标签底。
  // [VI V1.0 2026-09-07] 原先这两处硬编码绿 rgba(0,229,160)，导致琥珀色的温度卡配了绿底，
  //   且主色归蓝后仍是绿 —— 现改为跟随各卡 accent。
  score: { accent: T.green, accentSoft: 'rgba(0,191,255,0.15)', accentSoftBg: 'rgba(0,191,255,0.12)', label: '风控诊断结果', cta: '扫码测测你的风控画像' },
  // 温度卡：每日风险温度
  temperature: { accent: T.amber, accentSoft: 'rgba(255,176,32,0.15)', accentSoftBg: 'rgba(255,176,32,0.12)', label: '今日风险温度', cta: '扫码查看今天的温度' },
  // 挑战卡：挑战赛 / 守纪天数
  challenge: { accent: T.greenDeep, accentSoft: 'rgba(0,108,255,0.15)', accentSoftBg: 'rgba(0,108,255,0.12)', label: '风控纪律挑战', cta: '扫码加入 7 天训练营' }
};

Component({
  properties: {
    cardType: { type: String, value: 'score' },     // score | temperature | challenge
    value: { type: null, value: 0 },                 // 主数值（分数/温度/守纪天数）
    valueUnit: { type: String, value: '' },          // 单位后缀：分 / ° / 天
    tag: { type: String, value: '' },                // 段位标签，如「追高冲动型」
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    qrcodeUrl: { type: String, value: '' },          // /api/fission/qrcode 返回的图
    visible: { type: Boolean, value: false }
  },

  data: {
    canvasW: DESIGN_W,
    canvasH: DESIGN_H,
    generating: false,
    imgPath: ''
  },

  observers: {
    // 关键修复：canvas 在 wx:if 内，visible 变 true 时节点尚未渲染，
    // 必须等下一帧渲染完成再 query，否则 selectorQuery 取不到 node → "生成失败"。
    visible: function (v) { if (v) wx.nextTick(() => this.generate()); }
  },

  methods: {
    // ---------- 对外：重新生成 ----------
    generate() {
      if (this.data.generating) return;
      this.setData({ generating: true, imgPath: '' });

      this._getCanvas()
        .then(({ canvas, ctx }) => {
          // 先备好小程序码图对象（必须 onload 完成才能画）
          return this._loadQrImage(canvas).then((qrImg) => ({ canvas, ctx, qrImg }));
        })
        .then(({ canvas, ctx, qrImg }) => this._render(canvas, ctx, qrImg))
        .then((path) => {
          this.setData({ generating: false, imgPath: path });
          this.triggerEvent('generated', { path: path });
        })
        .catch((err) => {
          this.setData({ generating: false });
          wx.showToast({ title: '生成失败，请重试', icon: 'none' });
          this.triggerEvent('error', { err: String((err && err.errMsg) || err) });
        });
    },

    _getCanvas() {
      return new Promise((resolve, reject) => {
        wx.createSelectorQuery().in(this)
          .select('#shareCardCanvas').fields({ node: true, size: true })
          .exec((res) => {
            const info = res && res[0];
            if (!info || !info.node) return reject(new Error('canvas node not found'));
            const canvas = info.node;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('2d context not available'));
            resolve({ canvas, ctx });
          });
      });
    },

    // 下载并装载小程序码；失败返回 null（调用方画占位框）
    _loadQrImage(canvas) {
      const url = this.data.qrcodeUrl;
      if (!url) return Promise.resolve(null);

      return new Promise((resolve) => {
        wx.downloadFile({
          url: url,
          success: (res) => {
            if (res.statusCode !== 200 || !res.tempFilePath) return resolve(null);
            let img = null;
            try { img = canvas.createImage(); } catch (e) { return resolve(null); }
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = res.tempFilePath;
          },
          fail: () => resolve(null)
        });
      });
    },

    _render(canvas, ctx, qrImg) {
      const dpr = (wx.getSystemInfoSync && wx.getSystemInfoSync().pixelRatio) || 2;
      const ratio = Math.min(dpr, 3); // 上限 3，避免超大图内存爆
      canvas.width = DESIGN_W * ratio;
      canvas.height = DESIGN_H * ratio;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);

      this._paint(ctx, DESIGN_W, DESIGN_H, qrImg);

      return new Promise((resolve, reject) => {
        // 关键修复：Canvas 2D 的 x/y/width/height 是【画布缓冲像素】（= canvas.width/height），
        // 不是设计坐标 DESIGN_W/H。传设计坐标会在 dpr≥2 时把卡片裁成左上 1/ratio² 再放大。
        // 直接按整块缓冲导出，原生分辨率、不裁切。
        wx.canvasToTempFilePath({
          canvas: canvas,
          x: 0, y: 0,
          width: canvas.width,
          height: canvas.height,
          destWidth: canvas.width,
          destHeight: canvas.height,
          fileType: 'png',
          success: (r) => resolve(r.tempFilePath),
          fail: reject
        });
      });
    },

    // ---------- 绘制核心：坐标基于 DESIGN_W × DESIGN_H 设计坐标系 ----------
    _paint(ctx, W, H, qrImg) {
      const tpl = TEMPLATES[this.data.cardType] || TEMPLATES.score;
      const pad = 20;

      // 1) 背景
      ctx.fillStyle = T.bg;
      ctx.fillRect(0, 0, W, H);

      // 2) 主卡片
      this._roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 16);
      ctx.fillStyle = T.card;
      ctx.fill();

      // 3) 顶部主色渐变条
      const grad = ctx.createLinearGradient(pad, pad, W - pad, pad);
      grad.addColorStop(0, tpl.accent);
      grad.addColorStop(1, tpl.accentSoft);
      this._roundRect(ctx, pad, pad, W - pad * 2, 4, 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // 4) 类型标签
      ctx.textAlign = 'center';
      ctx.fillStyle = T.txt3;
      ctx.font = '11px sans-serif';
      ctx.fillText(tpl.label, W / 2, pad + 30);

      // 5) 主数值
      const val = String(this.data.value == null ? 0 : this.data.value);
      ctx.fillStyle = tpl.accent;
      ctx.font = 'bold 60px sans-serif';
      ctx.fillText(val, W / 2, pad + 88);

      // 6) 单位后缀
      if (this.data.valueUnit) {
        const w = ctx.measureText(val).width;
        ctx.font = '16px sans-serif';
        ctx.fillStyle = T.txt2;
        ctx.fillText(this.data.valueUnit, W / 2 + w / 2 + 12, pad + 86);
      }

      // 7) 段位标签（胶囊）
      if (this.data.tag) {
        const tagText = String(this.data.tag);
        ctx.font = 'bold 15px sans-serif';
        const tw = ctx.measureText(tagText).width + 24;
        this._roundRect(ctx, W / 2 - tw / 2, pad + 104, tw, 26, 13);
        ctx.fillStyle = tpl.accentSoftBg;
        ctx.fill();
        ctx.fillStyle = tpl.accent;
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(tagText, W / 2, pad + 122);
      }

      // 8) 标题 + 描述
      let y = pad + 166;
      if (this.data.title) {
        ctx.fillStyle = T.txt1;
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(this._clip(ctx, this.data.title, W - pad * 4), W / 2, y);
        y += 26;
      }
      if (this.data.desc) {
        ctx.fillStyle = T.txt2;
        ctx.font = '12px sans-serif';
        this._wrap(ctx, this.data.desc, W - pad * 4).slice(0, 2).forEach((ln) => {
          ctx.fillText(ln, W / 2, y);
          y += 18;
        });
      }

      // 9) 分隔线
      ctx.strokeStyle = T.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad + 16, H - pad - 116);
      ctx.lineTo(W - pad - 16, H - pad - 116);
      ctx.stroke();

      // 10) 小程序码 + CTA
      const qrSize = 72;
      const qrX = pad + 22;
      const qrY = H - pad - 100;
      if (qrImg) {
        try { ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize); }
        catch (e) { this._drawQrPlaceholder(ctx, qrX, qrY, qrSize); }
      } else {
        this._drawQrPlaceholder(ctx, qrX, qrY, qrSize);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = T.txt1;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(tpl.cta, qrX + qrSize + 14, qrY + 32);
      ctx.fillStyle = T.txt3;
      ctx.font = '11px sans-serif';
      ctx.fillText(this._today(), qrX + qrSize + 14, qrY + 54);

      // 11) 品牌 + 免责声明（合规红线：卡片上必须带）
      ctx.textAlign = 'center';
      ctx.fillStyle = T.txt3;
      ctx.font = '11px sans-serif';
      ctx.fillText('熵盾 · 每日风控仪表盘', W / 2, H - pad - 20);
      ctx.font = '10px sans-serif';
      ctx.fillText('本图仅为风控行为自评，不构成投资建议', W / 2, H - pad - 6);
    },

    // ---------- 绘图工具 ----------
    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },

    _drawQrPlaceholder(ctx, x, y, size) {
      ctx.strokeStyle = T.line;
      ctx.lineWidth = 1;
      this._roundRect(ctx, x, y, size, size, 8);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = T.txt3;
      ctx.font = '10px sans-serif';
      ctx.fillText('小程序码', x + size / 2, y + size / 2 + 4);
    },

    _clip(ctx, text, maxW) {
      let s = String(text || '');
      if (ctx.measureText(s).width <= maxW) return s;
      while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
      return s + '…';
    },

    _wrap(ctx, text, maxW) {
      const out = [];
      let line = '';
      String(text || '').split('').forEach((ch) => {
        if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; }
        else line += ch;
      });
      if (line) out.push(line);
      return out;
    },

    _today() {
      const d = new Date();
      const p = (n) => (n < 10 ? '0' + n : '' + n);
      return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
    },

    // ---------- 交互 ----------
    onClose() {
      this.setData({ visible: false, imgPath: '' });
      this.triggerEvent('close');
    },

    onSave() {
      const path = this.data.imgPath;
      if (!path) return;
      const self = this;
      wx.saveImageToPhotosAlbum({
        filePath: path,
        success() {
          wx.showToast({ title: '已保存到相册', icon: 'success' });
          self.triggerEvent('saved', { path: path });
        },
        fail(err) {
          const msg = String((err && err.errMsg) || '');
          if (msg.indexOf('auth deny') >= 0 || msg.indexOf('authorize') >= 0) {
            wx.showModal({
              title: '需要相册权限',
              content: '保存分享卡需要允许保存到相册，可在设置中开启后重试。',
              confirmText: '去设置',
              success(r) { if (r.confirm) wx.openSetting(); }
            });
          } else {
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        }
      });
    }
  }
});
