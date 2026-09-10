// pkgService/pointsRules/index.js —— 积分规则公示页（69 号 §1.3 合规留痕）
Page({
  data: {
    // 段位阈值与交换后端 pointsLevel 单一真源保持一致（Lv1-5 = 0/200/800/2500/6000）
    levels: [
      { lv: 1, name: 'Lv.1 守护者', threshold: '0 分起' },
      { lv: 2, name: 'Lv.2 守护者', threshold: '满 200 分' },
      { lv: 3, name: 'Lv.3 守护者', threshold: '满 800 分' },
      { lv: 4, name: 'Lv.4 守护者', threshold: '满 2500 分' },
      { lv: 5, name: 'Lv.5 守护者', threshold: '满 6000 分（封顶）' }
    ],
    gains: [
      { k: '每日打卡守纪', v: 5 },
      { k: '分享风控内容', v: 5 },
      { k: '学完一节课程', v: 20 },
      { k: '督察官每日打卡', v: 5 },
      { k: '完成督察任务', v: 200 },
      { k: '达成里程碑', v: '按里程碑' }
    ]
  }
});
