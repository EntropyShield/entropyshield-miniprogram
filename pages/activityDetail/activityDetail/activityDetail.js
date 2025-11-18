// 活动详情页面 (activityDetail.js)
Page({
  data: {
    activityName: '',
    activityDate: '',
    activityDescription: ''
  },
  onLoad(options) {
    // 接收从控局者俱乐部页面传递的参数
    this.setData({
      activityName: options.activityName,
      activityDate: options.activityDate,
      activityDescription: options.activityDescription
    });
  }
});
