// /utils/analytics/dataReporting.js

// 收集用户行为数据
function reportUsageData(eventName, data) {
  wx.reportAnalytics(eventName, data);
}

// 示例：用户点击了风控计算器的计算按钮
function reportRiskCalculatorUsage() {
  wx.reportAnalytics('risk_calculator_usage', {
    action: 'calculate_button_click',
    timestamp: new Date().toISOString()
  });
}

// 示例：用户报名了控局者沙龙
function reportClubActivityJoin(activityName) {
  wx.reportAnalytics('club_activity_join', {
    activity_name: activityName,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  reportUsageData,
  reportRiskCalculatorUsage,
  reportClubActivityJoin
};
