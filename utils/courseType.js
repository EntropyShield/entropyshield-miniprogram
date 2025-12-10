// utils/courseType.js
function getCourseTypeMeta(type) {
  switch (type) {
    case 'promo':
      return { text: '公开课', cssClass: 'tag-promo' };
    case 'trial':
      return { text: '体验课', cssClass: 'tag-trial' };
    case 'risk':
      return { text: '风控课', cssClass: 'tag-risk' };
    case 'salon':
      return { text: '线下沙龙', cssClass: 'tag-salon' };
    case 'pro':
      return { text: '成为控局者', cssClass: 'tag-pro' };
    default:
      return { text: '课程', cssClass: 'tag-default' };
  }
}

module.exports = {
  getCourseTypeMeta
};
