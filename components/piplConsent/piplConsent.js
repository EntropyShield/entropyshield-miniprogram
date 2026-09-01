Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '敏感信息授权'
    },
    desc: {
      type: String,
      value: '持仓、交易记录属于个人敏感信息。仅在您主动录入并授权后，熵盾才会在本地与服务器用于风控计算与诊断。您可随时在「个人中心」撤回。'
    }
  },
  data: {
    checked: false
  },
  methods: {
    toggle() {
      this.setData({ checked: !this.data.checked });
    },
    onAgree() {
      if (!this.data.checked) return;
      this.triggerEvent('agree');
    },
    onDecline() {
      this.triggerEvent('decline');
    }
  }
});
