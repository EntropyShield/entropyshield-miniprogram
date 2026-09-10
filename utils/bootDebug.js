// utils/bootDebug.js —— 启动调试开关（生产默认静默）
const __APP_DEBUG__ = false;

function appDebug() {
  if (!__APP_DEBUG__) return;
  try {
    console.log.apply(console, arguments);
  } catch (e) {}
}

module.exports = { appDebug };
