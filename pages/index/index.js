Page({
  data: {
    sentiment: [35, 48, 42, 55, 60, 58, 72],
    sentimentLabel: "乐观",
    sentimentColor: "#2AFF2A",
    news: [
      { id: 1, title: "全球市场波动加剧，投资者情绪谨慎", time: "2小时前" },
      { id: 2, title: "科技板块走强，AI 相关赛道回暖", time: "5小时前" },
      { id: 3, title: "央行政策预期影响市场结构性走向", time: "8小时前" }
    ],
    code: "",
    currentRisk: "null"
  },

  onShow: function () {
    this.drawLogo2D();
    this.drawChart2D();
  },

  /* ===== LOGO（40×40）：平顶六边形 + 空心蓝色 ∞（无中心横线） ===== */
  drawLogo2D: function () {
    var q = wx.createSelectorQuery();
    q.select('#entropyLogo').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0]) return;

      var canvas = res[0].node;
      var w = res[0].width, h = res[0].height;

      var sys = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
      var dpr = sys.pixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      var GREEN1 = '#2AFF2A';
      var GREEN2 = '#21FF7A';
      var BLUE1  = '#36CFFF';
      var BLUE2  = '#1E90FF';

      var cx = w / 2, cy = h / 2;
      var R  = Math.min(w, h) * 0.46;

      // 六边形
      var hexLW = Math.max(1, w * 0.095);
      var gradG = ctx.createLinearGradient(0, 0, w, h);
      gradG.addColorStop(0, GREEN1);
      gradG.addColorStop(1, GREEN2);

      ctx.save();
      ctx.strokeStyle = gradG;
      ctx.lineWidth   = hexLW;
      ctx.lineJoin    = 'round';
      ctx.shadowColor = 'rgba(42,255,42,0.35)';
      ctx.shadowBlur  = 2 * (w / 40);
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var ang = -Math.PI / 6 + i * Math.PI / 3;
        var x = cx + R * Math.cos(ang);
        var y = cy + R * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // 空心 ∞，不画中心横线
      var rx    = R * 0.34;
      var r     = R * 0.35;
      var infLW = Math.max(1, r * 0.50);

      var gradB = ctx.createLinearGradient(0, cy, w, cy);
      gradB.addColorStop(0, BLUE1);
      gradB.addColorStop(1, BLUE2);

      ctx.save();
      ctx.strokeStyle = gradB;
      ctx.lineWidth   = infLW;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.shadowColor = 'rgba(30,144,255,0.35)';
      ctx.shadowBlur  = 1.5 * (w / 40);

      ctx.beginPath();
      ctx.arc(cx - rx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx + rx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    });
  },

  /* ===== 情绪折线图 ===== */
  drawChart2D: function () {
    var query = wx.createSelectorQuery();
    query.select('#sentChart').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0]) return;

      var canvas = res[0].node;
      var width = res[0].width, height = res[0].height;

      var sys = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
      var dpr = sys.pixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#0F0F0F';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#2A2A2A';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 1; i < 4; i++) {
        var y = (i * height) / 4;
        ctx.moveTo(0, y); ctx.lineTo(width, y);
      }
      ctx.stroke();

      var data = [35, 48, 42, 55, 60, 58, 72];
      var max = Math.max.apply(null, data);
      var min = Math.min.apply(null, data);
      var pad = 30;
      var stepX = (width - pad * 2) / (data.length - 1);
      var scaleY = (height - pad * 2) / (max - min || 1);

      ctx.save();
      ctx.shadowColor = 'rgba(30,144,255,0.55)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#1E90FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (var j = 0; j < data.length; j++) {
        var v = data[j];
        var x = pad + j * stepX;
        var y2 = height - pad - (v - min) * scaleY;
        if (j === 0) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#2AFF2A';
      ctx.shadowColor = 'rgba(42,255,42,0.65)';
      ctx.shadowBlur = 10;
      for (var k = 0; k < data.length; k++) {
        var v2 = data[k];
        var x2 = pad + k * stepX;
        var y3 = height - pad - (v2 - min) * scaleY;
        ctx.beginPath();
        ctx.arc(x2, y3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  },

  onCode: function (e) {
    this.setData({ code: e.detail.value });
  },

  // 顶部按钮：进入风控计算器
  goCalc: function () {
    wx.navigateTo({ url: '/pages/riskCalculator/index' });
  },

  // 熵盾测评：带代码跳转
  goEval: function () {
    if (!this.data.code) {
      wx.showToast({ title: '请输入代码', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/riskCalculator/index?code=' + this.data.code
    });
  }
});
