'use strict';
const { API_BASE } = require('../../config');
const DOMAIN_IDS = ['R1', 'R2', 'R3', 'R4', 'R5'];
const ROOT = API_BASE + '/api/assessment-v1';
function fail(message) { throw new Error(message || 'REQUEST_FAILED'); }
function request(path, method, token, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: ROOT + path, method: method || 'GET',
      header: Object.assign({}, token ? { Authorization: 'Bearer ' + token } : {}, data ? {'content-type':'application/json'} : {}),
      data: data || {},
      success(res) {
        if (res.statusCode !== 200 || !res.data || res.data.ok !== true) {
          return reject(new Error((res.data && (res.data.error || res.data.message)) || 'HTTP_' + res.statusCode));
        }
        resolve(res.data.data);
      },
      fail: reject
    });
  });
}
function exchange() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(login) {
        if (!login.code) return reject(new Error('WX_LOGIN_CODE_MISSING'));
        wx.request({
          url: API_BASE + '/api/challenge-v1/auth/exchange', method:'POST',
          header:{'content-type':'application/json'},
          data:{freshWxCode:login.code, requestId:'brml5_' + Date.now()},
          success(res) {
            const payload = res.data || {};
            const body = payload.data || payload;
            if (res.statusCode !== 200 || payload.ok !== true || !body.sessionHandle) {
              return reject(new Error(payload.error || 'SESSION_EXCHANGE_FAILED'));
            }
            resolve(body.sessionHandle);
          },
          fail:reject
        });
      }, fail:reject
    });
  });
}
Page({
  data:{
    domains:DOMAIN_IDS, domain:'R1', loading:false, phase:'SELECT', message:'',
    attemptId:'', questions:[], answeredCount:0, result:null, resultText:'', ruleIds:[], ruleEvidence:[]
  },
  onUnload(){ this._token = null; },
  onChooseDomain(e){
    if (this.data.loading) return;
    const d=String(e.currentTarget.dataset.domain || '');
    if (DOMAIN_IDS.indexOf(d) < 0) return;
    this.setData({domain:d,phase:'SELECT',questions:[],result:null,message:'',answeredCount:0,attemptId:''});
  },
  async onStart(){
    if (this.data.loading) return;
    this.setData({loading:true,message:''});
    try{
      this._token = await exchange();
      const spec = await request('/spec?domain=' + encodeURIComponent(this.data.domain), 'GET', this._token);
      if (spec.question_count !== 8) fail('FORMAL_QUESTION_COUNT_MISMATCH');
      const attempt = await request('/attempts', 'POST', this._token, {domain:this.data.domain});
      if (!Array.isArray(attempt.items) || attempt.items.length !== 8) fail('ATTEMPT_ITEM_COUNT_INVALID');
      const questions = attempt.items.map(item => ({
        ordinal:item.ordinal, variant_id:item.variant_id, stem:item.stem,
        options:item.options.map(opt=>({option_id:opt.option_id,text:opt.text})),
        selected_option_id:''
      }));
      this.setData({phase:'ANSWER',attemptId:attempt.attempt_id,questions,answeredCount:0});
    }catch(e){this.setData({message:(e && e.message)||'无法开始测试，请稍后重试'});}
    finally{this.setData({loading:false});}
  },
  onChooseOption(e){
    if (this.data.phase !== 'ANSWER' || this.data.loading) return;
    const i=Number(e.currentTarget.dataset.index), option=String(e.currentTarget.dataset.option || '');
    const questions=this.data.questions.map(x=>Object.assign({},x));
    if (!questions[i] || !questions[i].options.some(x=>x.option_id===option)) return;
    questions[i].selected_option_id=option;
    this.setData({questions,answeredCount:questions.filter(x=>x.selected_option_id).length});
  },
  async onSubmit(){
    if (this.data.loading || this.data.phase!=='ANSWER') return;
    if (this.data.answeredCount!==8){wx.showToast({title:'请完成全部8题',icon:'none'});return;}
    this.setData({loading:true,message:''});
    try{
      const answers=this.data.questions.map(q=>({variant_id:q.variant_id,selected_option_id:q.selected_option_id}));
      await request('/attempts/'+encodeURIComponent(this.data.attemptId)+'/answers','PUT',this._token,{answers});
      const finalized=await request('/attempts/'+encodeURIComponent(this.data.attemptId)+'/finalize','POST',this._token,{});
      const result=await request('/attempts/'+encodeURIComponent(this.data.attemptId)+'/result','GET',this._token);
      if (!finalized.result_id || result.result_id!==finalized.result_id) fail('RESULT_ID_MISMATCH');
      const rules = await request('/attempts/'+encodeURIComponent(this.data.attemptId)+'/rules','GET',this._token);
      if (rules.result_id !== result.result_id || !Array.isArray(rules.rule_ids)) fail('RULE_EVIDENCE_MISMATCH');
      this.setData({phase:'RESULT',result,resultText:'风险指数 '+result.domain_risk+'% · 主要风险维度 '+result.top_driver,ruleIds:rules.rule_ids,ruleEvidence:rules.evidence || []});
    }catch(e){this.setData({message:(e && e.message)||'结果提交失败，可重试提交'});}
    finally{this.setData({loading:false});}
  },
  onRestart(){this.setData({phase:'SELECT',attemptId:'',questions:[],answeredCount:0,result:null,resultText:'',ruleIds:[],ruleEvidence:[],message:''});}
});
