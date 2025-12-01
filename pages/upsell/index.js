Page({
  contactService() {
    wx.showModal({
      title: '添加熵盾顾问',
      content: '请添加熵盾官方客服微信：EntropyShield\n备注“控局者咨询 + 昵称”。',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});
