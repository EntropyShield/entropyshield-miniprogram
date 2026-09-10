// utils/bootAgreement.js —— 启动时合规协议门
function checkAgreementGate(options) {
  try {
    const agreed = wx.getStorageSync('agreedTerms');
    if (!agreed) {
      let enc = '';
      try {
        const path = (options && options.path) || '';
        const q = (options && options.query) || {};
        const pairs = [];
        Object.keys(q).forEach((k) => {
          const v = q[k];
          if (v === undefined || v === null || v === '') return;
          pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
        });
        const full = pairs.length ? (path + '?' + pairs.join('&')) : path;
        enc = full ? encodeURIComponent(full) : '';
      } catch (e) {}
      wx.reLaunch({ url: '/pages/agreementGate/index' + (enc ? ('?entry=' + enc) : '') });
      return true;
    }
  } catch (e) {}
  return false;
}

module.exports = { checkAgreementGate };
