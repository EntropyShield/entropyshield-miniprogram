# 熵盾小程序｜手动开通/取消会员 SOP（一页版）
> 更新时间：2026-03-03  
> 服务器：/var/www/my-app  
> 定案脚本：  
> - /var/www/my-app/scripts/admin_migrate_phone.sh  
> - /var/www/my-app/scripts/admin_set_member.sh  

---

## 核心原则（必须牢记）
1) **会员以“微信号(openid/clientId)”为唯一身份**：真机是否付费，取决于该微信号对应 openid 的 `fission_user.membership_level / membership_expire_at`。  
2) **手机号只是辅助**：用于绑定/迁移到正确 openid，避免手机号被其他 openid 占用导致错配。  
3) **必须先让该微信号写入数据库**：用该微信号扫预览码进入小程序一次（建议进【裂变任务】页停 5 秒），否则后台会提示“openid 尚未写入数据库”。

---

## A. 真机准备（5 秒）
- 扫预览码进入小程序  
- 进入【裂变任务】页停 5 秒（确保请求 /api/wx/login、/api/fission/init、/api/fission/profile）

---

## B. 获取 OPENID（服务器执行）
```bash
tail -n 2000 /var/log/nginx/access.log | grep -E "/api/fission/profile\?clientId=" | tail -n 20
```

---

## C. 开通终身会员（服务器执行）
```bash
bash /var/www/my-app/scripts/admin_migrate_phone.sh OPENID 手机号 lifetime
```

验收（必须做）：
```bash
curl -s "https://api.entropyshield.com/api/fission/profile?clientId=OPENID"
```
看到：`membership_level` = `LIFETIME`，`membership_expire_at` = `null`

---

## D. 开通月/季/年卡（服务器执行）
```bash
bash /var/www/my-app/scripts/admin_set_member.sh OPENID VIP_MONTH   手机号
bash /var/www/my-app/scripts/admin_set_member.sh OPENID VIP_QUARTER 手机号
bash /var/www/my-app/scripts/admin_set_member.sh OPENID VIP_YEAR    手机号
```

验收：
```bash
curl -s "https://api.entropyshield.com/api/fission/profile?clientId=OPENID"
```

---

## E. 取消会员（回到 FREE）（服务器执行）
```bash
bash /var/www/my-app/scripts/admin_set_member.sh OPENID FREE
```

验收：
```bash
curl -s "https://api.entropyshield.com/api/fission/profile?clientId=OPENID"
```
看到：`membership_level` = `FREE`

---

## F. 真机端生效动作（必须做）
1) 把小程序从后台彻底划掉  
2) 重新进入小程序  
3) 再点一次需要权限的功能（如“加强版”）

---

## G. 变更后备份（固定流程）
服务器：
```bash
bash /root/backup_server.sh
```
