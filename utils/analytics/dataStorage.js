// /utils/analytics/dataStorage.js

// 保存数据到本地存储
function saveToStorage(key, data) {
  try {
    wx.setStorageSync(key, data);
  } catch (e) {
    console.error('数据保存失败:', e);
  }
}

// 从本地存储读取数据
function getFromStorage(key) {
  try {
    return wx.getStorageSync(key);
  } catch (e) {
    console.error('数据读取失败:', e);
    return null;
  }
}

// 清除本地存储的数据
function removeFromStorage(key) {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    console.error('数据清除失败:', e);
  }
}

module.exports = {
  saveToStorage,
  getFromStorage,
  removeFromStorage
};
