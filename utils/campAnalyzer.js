// utils/campAnalyzer.js

/**
 * 单日风控打卡分析引擎
 * - 输入：某一天的打卡文本
 * - 输出：0~100 执行分 + 标签 + 建议
 */
function analyzeDailyLog(log) {
  const {
    day,
    dailyNote = '',
    practiceNote = '',
    reviewNote = '',
    homeworkNote = ''
  } = log || {};

  const fields = [dailyNote, practiceNote, reviewNote, homeworkNote];
  const filledCount = fields.filter(v => (v || '').trim().length > 0).length;

  // 基础分：40 + 每填一块 +10
  let score = 40 + filledCount * 10;
  let tags = [];
  let advices = [];

  const textAll = fields
    .join('\n')
    .toLowerCase()
    .replace(/，/g, ',')
    .replace(/。/g, '.');

  // 关键词简单规则
  const hasHeavyPosition =
    textAll.includes('满仓') ||
    textAll.includes('重仓') ||
    textAll.includes('all in') ||
    textAll.includes('梭哈');
  if (hasHeavyPosition) {
    score -= 15;
    tags.push('仓位偏激进');
    advices.push('你有使用「满仓 / 重仓 / 梭哈」的倾向，建议单笔不超过总资金 20%。');
  }

  const noStopLoss =
    textAll.includes('不止损') ||
    textAll.includes('没止损') ||
    textAll.includes('不设止损') ||
    textAll.includes('不设止盈');
  if (noStopLoss) {
    score -= 15;
    tags.push('缺乏止损纪律');
    advices.push('请为每一笔交易事先写好止损价和最大亏损金额，并在盘前确认一次。');
  }

  const hasChasing =
    textAll.includes('追高') ||
    textAll.includes('杀跌') ||
    textAll.includes('冲动') ||
    textAll.includes('情绪化');
  if (hasChasing) {
    score -= 10;
    tags.push('情绪驱动决策');
    advices.push('建议在下单前强制等待 3 分钟，再确认仓位与止损是否合理。');
  }

  const hasReview =
    textAll.includes('复盘') || textAll.includes('总结') || textAll.includes('记录');
  if (hasReview) {
    score += 5;
    tags.push('有复盘意识');
  } else if (filledCount > 0) {
    advices.push('建议每天至少写下 3 行交易复盘，帮助你看清自己的行为模式。');
  }

  const hasRiskWord =
    textAll.includes('风险') || textAll.includes('回撤') || textAll.includes('亏损');
  if (hasRiskWord) {
    tags.push('开始关注回撤');
  }

  // 根据 day 微调（可选）
  if (day === 'D1' && filledCount > 0) {
    advices.push('D1 的关键目标是「止亏觉醒」，请特别关注自己重复出现的亏损模式。');
  }

  if (day === 'D7' && filledCount > 0) {
    advices.push('建议把本周最重要的 3 条风控铁律，誊写到纸上贴在屏幕旁边。');
  }

  // 分数边界
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // 如果完全没填，给一个温和提示
  if (!filledCount) {
    score = 0;
    tags = ['未填写记录'];
    advices = ['建议至少记录一条今日关键行为，长期坚持才能看到自己的变化。'];
  }

  return {
    score,
    tags,
    advices
  };
}

/**
 * 7 日风控执行报告构建器
 * - 读取本地 campDailyLogs
 * - 输出：summary / metrics / days / advices
 */
function buildCampReport() {
  // D1-D7 对应标题（和训练营保持一致）
  const dayMeta = {
    D1: { name: '止亏觉醒' },
    D2: { name: '账户体检' },
    D3: { name: '仓位框架' },
    D4: { name: '止损规则' },
    D5: { name: '盈利结构' },
    D6: { name: '情绪减震' },
    D7: { name: '系统固化' }
  };
  const order = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];

  const allLogs = wx.getStorageSync('campDailyLogs') || {};

  const days = [];
  let sumScore = 0;
  let finishedCount = 0;
  let maxScore = -1;
  let maxDay = '';
  let minScore = 101;
  let minDay = '';
  let allTags = [];

  order.forEach((day) => {
    const meta = dayMeta[day] || { name: '' };
    const log = allLogs[day];
    const finished = !!(log && log.finished);
    const score = finished && typeof log.score === 'number' ? log.score : 0;
    const tags = (log && log.tags) || [];

    if (finished) {
      finishedCount += 1;
      sumScore += score;
      if (score > maxScore) {
        maxScore = score;
        maxDay = day;
      }
      if (score < minScore) {
        minScore = score;
        minDay = day;
      }
    }

    allTags = allTags.concat(tags);

    days.push({
      day,
      name: meta.name,
      score,
      finished,
      scoreText: finished ? `${score} 分` : '未打卡'
    });
  });

  const avgScore = finishedCount ? Math.round(sumScore / finishedCount) : 0;
  const finishedRate = Math.round((finishedCount / order.length) * 100);

  // ️控局者等级体系（徽章）
  let levelText;
  let levelClass;
  let badgeName;
  let badgeDesc;

  if (!finishedCount) {
    levelText = '未启动';
    badgeName = '观望者';
    badgeDesc = '建议先完成至少 1 天打卡，体验完整的风控执行流程。';
    levelClass = 'badge-gray';
  } else if (avgScore < 40) {
    levelText = '高风险区';
    badgeName = '漂流型交易者';
    badgeDesc = '执行分偏低，说明风控规则还没有真正落地，建议从 D1-D3 重练。';
    levelClass = 'badge-danger';
  } else if (avgScore < 60) {
    levelText = '起步阶段';
    badgeName = '初阶控局者';
    badgeDesc = '已经开始关心回撤，但执行还不稳定，需要多做小仓位演练。';
    levelClass = 'badge-warn';
  } else if (avgScore < 80) {
    levelText = '良好状态';
    badgeName = '进阶控局者';
    badgeDesc = '说明你已经能大部分时间遵守风控规则，可以开始考虑优化策略。';
    levelClass = 'badge-good';
  } else {
    levelText = '稳健区';
    badgeName = '量化控局者';
    badgeDesc = '你的执行力非常稳定，已经具备接近机构的风控习惯，请保持。';
    levelClass = 'badge-excellent';
  }

  const summary = {
    title: '7 日风控执行总评',
    subtitle: finishedCount
      ? `已完成 ${finishedCount} / ${order.length} 天打卡，平均执行分 ${avgScore} 分。`
      : '还没有任何打卡记录，建议先从 D1 开始完成第一天训练。',
    score: avgScore,
    levelText,
    levelClass,
    badgeName,
    badgeDesc,
    finishedDays: finishedCount,
    finishedRate
  };

  const metrics = [
    {
      label: '完成天数',
      value: `${finishedCount} / ${order.length}`,
      hint: '至少完成 5 天，会明显感受到风控习惯的变化。',
      type: 'primary'
    },
    {
      label: '平均执行分',
      value: `${avgScore} 分`,
      hint: '建议长期保持在 60 分以上。',
      type: 'primary'
    },
    {
      label: '最佳执行日',
      value: maxScore >= 0 ? `${maxDay || ''} · ${maxScore} 分` : '暂无',
      hint: '记录那天你做对了什么，形成可复制的习惯。',
      type: 'normal'
    },
    {
      label: '待补课日',
      value:
        minScore <= 100 && minScore >= 0 && finishedCount
          ? `${minDay || ''} · ${minScore} 分`
          : '暂无',
      hint: '建议对分数最低的一天重新写一份打卡与复盘。',
      type: 'normal'
    }
  ];

  // 汇总标签 & 建议
  const tagSet = Array.from(new Set(allTags.filter(Boolean)));

  const advices = [];

  if (!finishedCount) {
    advices.push(
      '先完成 D1「止亏觉醒」和 D2「账户体检」两天任务，再来看报告会更有意义。',
      '建议每天抽 10～20 分钟，用小仓位 + 严止损完成训练任务。'
    );
  } else {
    if (tagSet.includes('缺乏止损纪律')) {
      advices.push('在所有问题中，「止损」优先级最高。建议为每一笔交易写在纸上的止损价。');
    }
    if (tagSet.includes('情绪驱动决策')) {
      advices.push('建议给自己设定「看盘次数上限」，并在下单前强制等待 3 分钟再操作。');
    }
    if (tagSet.includes('有复盘意识')) {
      advices.push('保持每天写 3 行复盘文字，你会在 1～3 个月内看见明显变化。');
    }
    if (!advices.length) {
      advices.push('继续保持打卡习惯，风控系统的改变通常在 3～6 个月后会非常明显。');
    }
  }

  // 再附加一条与等级相关的建议
  advices.push(badgeDesc);

  return {
    summary,
    metrics,
    days,
    advices
  };
}

module.exports = {
  analyzeDailyLog,
  buildCampReport
};
