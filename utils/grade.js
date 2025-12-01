// utils/grade.js
// 统一由这里根据分数 / 打卡天数，返回控局者等级 + 徽章文件名（lv1.png ~ lv7.png）

function getLevelInfo(score, effectiveDays, goodDays, badDays, tags = []) {
  // 兜底，防止传进来奇怪的值
  score = Number(score) || 0;
  effectiveDays = Number(effectiveDays) || 0;
  goodDays = Number(goodDays) || 0;
  badDays = Number(badDays) || 0;

  // ===== 1. 根据分数粗分等级（可以以后再微调规则） =====
  let levelNumber = 1;

  if (score < 40) {
    levelNumber = 1;
  } else if (score < 60) {
    levelNumber = 2;
  } else if (score < 70) {
    levelNumber = 3;
  } else if (score < 80) {
    levelNumber = 4;
  } else if (score < 85) {
    levelNumber = 5;
  } else if (score < 92) {
    levelNumber = 6;
  } else {
    levelNumber = 7;
  }

  // 少于 3 天有效记录时，最多不超过 Lv.2
  if (effectiveDays < 3 && levelNumber > 2) {
    levelNumber = 2;
  }

  // ===== 2. 每个等级的文案、徽章文件、颜色 =====
  const levelTable = {
    1: {
      name: 'Lv.1 记录尝试者',
      tag: '开始关注风控',
      badge: 'lv1.png',
      toneClass: 'level-mid',
      desc: '你正在尝试用文字记录自己的交易行为，这是迈向控局者的第一步。'
    },
    2: {
      name: 'Lv.2 记录养成者',
      tag: '记录有起步',
      badge: 'lv2.png',
      toneClass: 'level-mid',
      desc: '你已经可以在部分交易日留下记录，只要把记录做满一周，画像会更加清晰。'
    },
    3: {
      name: 'Lv.3 风控意识觉醒者',
      tag: '开始有风控框架',
      badge: 'lv3.png',
      toneClass: 'level-mid',
      desc: '你开始主动思考止损、仓位和情绪，风控已经从“偶尔想到”变成“偶尔做到”。'
    },
    4: {
      name: 'Lv.4 执行力养成者',
      tag: '执行在成形',
      badge: 'lv4.png',
      toneClass: 'level-low', // 绿色
      desc: '多天交易能够按计划执行止损 / 仓位控制，账户稳定性正逐步提升。'
    },
    5: {
      name: 'Lv.5 稳定控局者',
      tag: '执行稳定',
      badge: 'lv5.png',
      toneClass: 'level-low',
      desc: '你已经具备相对稳定的风控执行习惯，只要继续复盘和微调规则，就能放大长期优势。'
    },
    6: {
      name: 'Lv.6 进阶控局者',
      tag: '长期风控约束',
      badge: 'lv6.png',
      toneClass: 'level-low',
      desc: '你开始用「最大回撤 / 盈亏结构 / 情绪阈值」等指标管理账户，已经非常接近专业级控局者。'
    },
    7: {
      name: 'Lv.7 策略型控局者',
      tag: '系统化风控',
      badge: 'lv7.png',
      toneClass: 'level-low',
      desc: '你具备系统化的风控执行与复盘框架，适合进一步叠加策略回测与资金曲线管理。'
    }
  };

  const info = levelTable[levelNumber] || levelTable[1];

  return {
    levelNumber,
    name: info.name,
    tag: info.tag,
    toneClass: info.toneClass,
    badge: info.badge,   // ⚠️ 只返回 lv1.png / lv2.png ……
    desc: info.desc
  };
}

module.exports = {
  getLevelInfo
};
