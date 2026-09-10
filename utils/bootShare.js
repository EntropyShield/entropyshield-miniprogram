// utils/bootShare.js —— 全局默认分享菜单与分享内容
const { appDebug } = require('./bootDebug');

const __RAW_PAGE__ = Page;

function buildQuery(obj) {
  const pairs = [];
  Object.keys(obj || {}).forEach((k) => {
    const v = obj[k];
    if (v === undefined || v === null || v === '') return;
    pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  });
  return pairs.join('&');
}

function defaultShare(ctx) {
  const route = (ctx && ctx.route) ? ('/' + ctx.route) : '/pages/index/index';
  const query = buildQuery((ctx && ctx.options) || {});
  return {
    title: '熵盾风控管理工具',
    path: query ? (route + '?' + query) : route,
    query: query
  };
}

function installGlobalShare() {
  Page = function(pageOptions) {
    const opts = pageOptions || {};
    const rawOnShow = opts.onShow;
    const rawShareAppMessage = opts.onShareAppMessage;
    const rawShareTimeline = opts.onShareTimeline;

    opts.onShow = function() {
      try {
        wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
      } catch (e) {
        appDebug('[GLOBAL_SHARE] showShareMenu fail =>', e);
      }
      if (typeof rawOnShow === 'function') {
        return rawOnShow.apply(this, arguments);
      }
    };

    if (typeof rawShareAppMessage !== 'function') {
      opts.onShareAppMessage = function() {
        return defaultShare(this);
      };
    }

    if (typeof rawShareTimeline !== 'function') {
      opts.onShareTimeline = function() {
        const share = defaultShare(this);
        return { title: share.title, query: share.query || '' };
      };
    }

    return __RAW_PAGE__(opts);
  };
}

module.exports = { installGlobalShare };
