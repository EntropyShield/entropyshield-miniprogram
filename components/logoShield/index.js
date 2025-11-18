Component({
  properties:{
    size: { type: Number, value: 44 },     // 画布宽高（像素）
    green: { type: String, value: "#2AFF2A" },
    blue:  { type: String, value: "#1E90FF" }
  },
  lifetimes:{
    ready(){ this.drawLogo(); }
  },
  methods:{
    drawLogo(){
      const query = this.createSelectorQuery();
      query.select('#logo').fields({ node:true, size:true }).exec(res=>{
        if(!res || !res[0]) return;
        const canvas = res[0].node;
        const cssW = res[0].width;
        const cssH = res[0].height;

        // 高分屏处理
        const win = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
        const dpr = win.pixelRatio || 1;
        canvas.width  = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // 透明背景
        ctx.clearRect(0,0,cssW,cssH);

        const cx = cssW/2, cy = cssH/2;
        const R  = Math.min(cssW, cssH) * 0.45; // 六边形半径

        // 六边形描边（绿色，发光）
        ctx.save();
        ctx.strokeStyle = this.data.green;
        ctx.lineWidth = Math.max(2, cssW*0.06);
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(42,255,42,0.6)';
        ctx.shadowBlur  = Math.max(6, cssW*0.12);

        ctx.beginPath();
        for(let i=0;i<6;i++){
          const ang = -Math.PI/2 + i * Math.PI/3; // 顶部向上
          const x = cx + R * Math.cos(ang);
          const y = cy + R * Math.sin(ang);
          i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // ∞ 符号（两圆近似 + 发光）
        const rx = R * 0.40;         // 两圆心到中心的水平距离
        const r  = R * 0.28;         // 圆半径
        const lw = Math.max(2, cssW*0.07);

        ctx.save();
        ctx.strokeStyle = this.data.blue;
        ctx.lineWidth   = lw;
        ctx.shadowColor = 'rgba(30,144,255,0.65)';
        ctx.shadowBlur  = Math.max(6, cssW*0.14);

        // 左环
        ctx.beginPath();
        ctx.arc(cx - rx, cy, r, 0, Math.PI*2);
        ctx.stroke();

        // 右环
        ctx.beginPath();
        ctx.arc(cx + rx, cy, r, 0, Math.PI*2);
        ctx.stroke();

        // 中间轻微连线（让“∞”更连贯）
        ctx.beginPath();
        ctx.moveTo(cx - rx + r*0.1, cy);
        ctx.lineTo(cx + rx - r*0.1, cy);
        ctx.stroke();

        ctx.restore();
      });
    }
  }
});
