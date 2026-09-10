// components/shareCard/index.js
// [V2.0-C4] 分享卡 Canvas 三模板：温度卡 / 分数卡 / 挑战卡
//
// ★ 2026-09-09 迁移说明（从 pkgTest/components/shareCard 提到主包）
//   原因：微信小程序**主包页面不能引用分包内的自定义组件**（反向可以）。
//   首页（主包 pages/index）要做温度卡分享，必须把组件放主包；
//   主包组件可被分包引用，故 pkgTest/resultCommon 改用同一份，不再各存一份。
//
// 为什么做：裂变闭环的最后一厘米。分享出去只是"微信截屏"没有谈资，
// 本组件把结果画成一张真卡片：数字 + 段位 + 小程序码 + 日期，让"晒"自带传播力。
//
// 设计约束：
// 1. Canvas 2D（type="2d"）—— 官方推荐路径，旧版 canvas-id 已不建议新用。
// 2. 卡片必须带免责声明 —— 12 号合规报告红线，禁止出现"建议/收益承诺"措辞。
// 3. 小程序码复用既有 /api/fission/qrcode 接口（fissionTask 已在用），不另造轮子。
//
// 关键坑（已修，勿回退）：
// · Canvas 2D 的 drawImage 必须等图片 onload 完成，同步写会画出空白；
// · createImage 是 canvas 对象的方法（canvas.createImage），不是 wx.createImage；
// · 小程序码拿不到时画占位框兜底，绝不让整张卡出不来；
// · canvasToTempFilePath 的 width/height 是画布缓冲像素，传设计坐标会裁图。

// 画布设计尺寸（CSS px）。导出时按 pixelRatio 放大，保证高清。
const DESIGN_W = 300;
const DESIGN_H = 400;

// 设计令牌的 Canvas 版（Canvas 读不到 CSS 变量，需在此镜像；改主色时两处同改）
const T = {
  bg: '#03060C',      // --es-bg
  card: '#07111E',    // --es-card
  line: '#4B5663',    // --es-line
  green: '#00BFFF',   // 品牌主色 Electric Blue
  greenDeep: '#006CFF',
  red: '#FF4D5E',
  amber: '#FFB020',
  blue: '#006CFF',
  txt1: '#F4F7FA',
  txt2: '#AAB4BE',
  txt3: '#8E98A3',
};

// 三套模板。disclaimer 按卡类型区分 —— 温度卡说的是"市场波动度量"，
// 若沿用分数卡的"行为自评"会与卡面内容不符（合规红线：措辞必须与卡面一致）。
const TEMPLATES = {
  score: { accent: T.green, accentSoft: 'rgba(0,191,255,0.15)', accentSoftBg: 'rgba(0,191,255,0.12)', label: '风控诊断结果', cta: '扫码测测你的风控画像', disclaimer: '本图仅为风控行为自评，不构成投资建议' },
  temperature: { accent: T.amber, accentSoft: 'rgba(255,176,32,0.15)', accentSoftBg: 'rgba(255,176,32,0.12)', label: '今日风险温度', cta: '扫码查看今天的温度', disclaimer: '本图仅为市场波动度量，不构成投资建议' },
  challenge: { accent: T.greenDeep, accentSoft: 'rgba(0,108,255,0.15)', accentSoftBg: 'rgba(0,108,255,0.12)', label: '风控纪律挑战', cta: '扫码加入 7 天训练营', disclaimer: '本图仅为纪律挑战记录，不构成投资建议' },
  // [2026-09-10] 年报晒图节（62 号 C 场）：desc 自动换行最多 3 行，文案请控制在 50 字内
  annual: { accent: T.amber, accentSoft: 'rgba(255,176,32,0.15)', accentSoftBg: 'rgba(255,176,32,0.12)', label: '我的年度风控报告', cta: '扫码生成你的年度风控报告', disclaimer: '本图仅为你本人风控行为统计，不含收益数据，不构成投资建议' }
};

Component({
  properties: {
    cardType: { type: String, value: 'score' },     // score | temperature | challenge
    value: { type: null, value: 0 },                 // 主数值（分数/温度/守纪天数）
    valueUnit: { type: String, value: '' },          // 单位后缀：分 / ° / 天
    tag: { type: String, value: '' },                // 段位标签，如「追高冲动型」/「中」
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    qrcodeUrl: { type: String, value: '' },          // /api/fission/qrcode 返回的图
    // [2026-09-09] 主色可覆盖：温度要随档位变色（低绿/中黄/高红），
    //   固定琥珀色会让 80 分的"极高"和 30 分的"低"看起来一样。
    accentColor: { type: String, value: '' },
    accentSoftColor: { type: String, value: '' },
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
      const accent = this.data.accentColor || tpl.accent;
      const accentSoft = this.data.accentSoftColor || tpl.accentSoft;
      const accentSoftBg = tpl.accentSoftBg;
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
      grad.addColorStop(0, accent);
      grad.addColorStop(1, accentSoft);
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
      ctx.fillStyle = accent;
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
        ctx.fillStyle = accentSoftBg;
        ctx.fill();
        ctx.fillStyle = accent;
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
        this._wrap(ctx, this.data.desc, W - pad * 4).slice(0, 3).forEach((ln) => {
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
      // [ESOS-01 1.4.9] 核心桥梁句（冻结标准表达，禁止改写/简写）
      ctx.fillText('熵盾 · 赚钱靠规则，守钱靠风控', W / 2, H - pad - 20);
      ctx.font = '10px sans-serif';
      ctx.fillText(tpl.disclaimer, W / 2, H - pad - 6);
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
