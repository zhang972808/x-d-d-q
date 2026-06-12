# xddq.sea666.cn 网站分析

## 概述

这是一个游戏辅助托管平台(商业化游戏脚本),基于:
- **前端**: React 18 + Ant Design + Redux Toolkit
- **后端**: Node.js/Express (推测) + Kubernetes 容器管理
- **游戏**: 37平台游戏(兄弟东契奇/弹弹奇兵类),通过多渠道接入

---

## 一、前端架构

### 技术栈
- React 18 + React Router
- Ant Design (antd) UI组件库
- Redux Toolkit (状态管理)
- Webpack 打包

### 页面结构
| 页面 | 路由 | 描述 |
|------|------|------|
| 登录页 | `/login` 或 `/` | 用户登录,支持多种UI主题 |
| 注册页 | `/register` | 新用户注册 |
| 首页 | `/home` | 仪表盘,容器状态,子账号概览 |
| 配置文件 | `/config` | 游戏脚本配置 |
| 控制台 | `/console` | 实时日志查看(k8s容器日志流) |
| 个人中心 | `/profile` | 用户信息,子账号管理 |
| 管理后台 | `/admin/*` | 管理员功能(用户/订单/工单管理) |

### 登录页主题
平台提供多种主题:
- `GARDEN` - 花园主题
- `LHS` - 莲花山主题
- `ZMSL` - 紫墨山林主题
- `DEFAULT` - 默认主题

---

## 二、后端 API 接口 (完整)

### 2.1 认证 (Auth)

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/reset` | 重置密码 |

### 2.2 渠道管理 (Channel)

#### QQ渠道
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/chan/qq/servers` | 获取37服务器列表 (params: username, password) |
| POST | `/api/chan/qq/` | 渠道登录/绑定 |
| POST | `/api/chan/qq/{id}/token` | 更新子账号token和昵称 |

#### 抖音渠道
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/chan/douyin/` | 渠道信息 |
| GET | `/api/chan/douyin/{code}/verify` | 验证抖音token |
| GET | `/api/chan/douyin/{code}/servers` | 获取服务器列表 |

#### Vivo渠道
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/chan/vivo/` | 渠道信息 |
| GET | `/api/chan/vivo/captcha` | 获取滑块验证码 |
| POST | `/api/chan/vivo/captcha/solve` | 提交滑块验证 |
| POST | `/api/chan/vivo/sms-code` | 发送短信验证码 |
| POST | `/api/chan/vivo/fast-login` | vivo快速登录(短信验证码登录) |
| POST | `/api/chan/vivo/verify-idcard` | 验证身份证后六位 |
| POST | `/api/chan/vivo/select-sub` | 选择vivo子账号 |
| PUT | `/api/chan/vivo/` | 保存vivo token |
| GET | `/api/chan/vivo/phone-servers` | 通过手机号获取服务器列表 |
| POST | `/api/chan/vivo/{id}/token` | 更新子账号token |

#### OPPO渠道
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/chan-oppo/sms-code` | 发送短信验证码 |
| GET | `/api/chan-oppo/phone-servers` | 通过手机号获取服务器列表 |
| POST | `/api/chan-oppo/` | OPPO渠道登录 |
| PUT | `/api/chan-oppo/{id}/token` | 保存OPPO token |
| POST | `/api/chan-oppo/{id}/token` | 更新OPPO token |

#### 小米渠道
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/chan/xiaomi/servers` | 获取小米服务器列表 |
| POST | `/api/chan/xiaomi/sms-code` | 发送短信验证码 |
| GET | `/api/chan/xiaomi/phone-servers` | 通过手机号获取服务器列表 |
| POST | `/api/chan/xiaomi/` | 小米渠道登录 |
| PUT | `/api/chan/xiaomi/{id}/token` | 保存小米token |
| POST | `/api/chan/xiaomi/{id}/token` | 更新小米token |

#### 支付宝渠道
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/chan/zfb/{code}/verify` | 验证支付宝token |
| POST | `/api/chan/zfb/{id}/token` | 更新支付宝子账号token |

#### APP渠道
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/chan/app/servers` | 获取APP渠道服务器列表 |
| POST | `/api/chan/app/` | APP渠道登录 |
| POST | `/api/chan/app/{id}/token` | 更新APP子账号token |

#### 通用渠道
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/chan/{channel}/qr` | 获取渠道二维码 |
| GET | `/api/chan/{channel}/valid` | 验证渠道二维码 (params: code) |
| GET | `/api/chan/{channel}/servers` | 获取渠道服务器列表 |
| POST | `/api/chan/{channel}/{id}/token` | 更新渠道token (data: code/token, purpose) |

### 2.3 容器管理 (Kubernetes)

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/kubernetes/run` | 启动容器(运行脚本) |
| POST | `/api/kubernetes/stop` | 停止容器(停止脚本) |
| GET | `/api/kubernetes/queue-position` | 查询排队位置 |
| GET | `/api/kubernetes/log-stream-poll` | 轮询日志流 |

### 2.4 通用状态

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/common/status` | 获取容器状态 (data: podName array) |
| GET | `/api/common/notice/{id}` | 获取公告详情 |
| GET | `/api/maintenance/status` | 维护模式状态 |

### 2.5 子账号管理 (Sub-User)

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/sub-user/{id}` | 获取子账号详情 |
| POST | `/api/sub-user/` | 创建子账号 |
| PUT | `/api/sub-user/{id}` | 更新子账号 |
| DELETE | `/api/sub-user/{id}` | 删除子账号 |
| POST | `/api/sub-user/bind` | 绑定子账号 |
| GET | `/api/sub-user/{id}/setting` | 获取子账号配置 |
| PUT | `/api/sub-user/{id}/setting` | 保存子账号配置 |
| POST | `/api/sub-user/{id}/setting/import` | 导入配置 |
| GET | `/api/sub-user/delete-records` | 获取删除记录 |
| PUT | `/api/sub-user/{id}/password` | 修改子账号密码 |
| POST | `/api/sub-user/{id}/exp` | 开通试用 |

### 2.6 用户管理 (User)

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/user/invite-code` | 获取邀请码 |
| GET | `/api/user/quota` | 获取配额信息 |
| GET | `/api/user/stats` | 获取用户统计 |
| GET | `/api/user/sub-users` | 获取子用户列表 |
| PUT | `/api/user/password` | 修改密码 |
| DELETE | `/api/user/secondary-password` | 申请重置二级密码 |
| PUT | `/api/user/secondary-password` | 修改二级密码 |
| POST | `/api/user/secondary-password/verify` | 验证二级密码 |
| POST | `/api/user/assign/record` | 分配记录 |
| POST | `/api/sub-user/{id}/password` | 修改子账号密码 |

### 2.7 工单系统 (Ticket)

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/ticket` | 获取我的工单列表 |
| GET | `/api/ticket/{id}` | 获取工单详情 |
| POST | `/api/ticket` | 创建工单 |
| PUT | `/api/ticket/{id}` | 更新工单(用户端) |
| POST | `/api/ticket/{id}` | 回复工单 |
| PUT | `/api/ticket/{id}/close` | 办结工单 |
| PUT | `/api/admin/ticket/{id}` | 更新工单(管理员) |

### 2.8 管理后台 (Admin)

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/admin/user/list` | 获取用户列表 |
| PUT | `/api/admin/user/{id}` | 更新用户 |
| DELETE | `/api/admin/user/{id}` | 删除用户 |
| GET | `/api/admin/orders` | 获取订单列表 |
| GET | `/api/admin/stats` | 获取统计数据 |
| GET | `/api/admin/agent/stats` | 获取代理盈亏统计 |
| POST | `/api/admin/agent/transfer-stats` | 转账统计 |
| GET | `/api/admin/audit-logs` | 获取审计日志 |
| GET | `/api/admin/monthly-revenue` | 月度收入 |
| GET | `/api/admin/notices` | 公告列表 |
| POST | `/api/admin/notice` | 发布公告 |
| DELETE | `/api/admin/notice` | 删除公告 |
| POST | `/api/admin/refund` | 处理退款 |
| POST | `/api/admin/refund-only` | 仅退款 |
| POST | `/api/admin/maintenance/status` | 设置维护模式 |
| GET | `/api/admin/version` | 获取版本信息 |
| POST | `/api/admin/version` | 更新版本信息 |
| GET | `/api/admin/ticket` | 获取工单列表 |
| GET | `/api/admin/ticket/{id}` | 获取工单详情 |
| POST | `/api/admin/ticket/{id}` | 回复工单 |
| DELETE | `/api/admin/ticket/{id}` | 删除工单 |
| DELETE | `/api/admin/ticket/batch` | 批量删除工单 |
| GET | `/api/admin/sub-pod` | 获取子用户pod |
| GET | `/api/admin/node-metrics` | 节点指标 |
| POST | `/api/admin/assign/record` | 分配记录 |
| GET | `/api/admin/sub-users` | 获取子用户列表 |

### 2.9 支付/兑换

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/payment/create` | 创建支付订单 |
| GET | `/api/payment/query/{id}` | 查询支付状态 |
| POST | `/api/redemption/submit` | 提交兑换 |
| GET | `/api/redemption/winners` | 获奖名单 |

---

## 三、游戏连接协议

平台通过后端代理游戏连接,核心认证链路:

### 登录流程
```
用户 -> 前端 -> 后端API -> 37.com SDK
  1. POST 37.com mysdk API (login_account + encrypted password)
     -> 返回 ptoken + uid + userinfo
  2. POST 37.com apimyh5 API (ptoken + puid)
     -> 返回 app_pst
  3. POST proxy-xddq-cn.ap3615.com/s{serverId}_http/player/login
     (data: appID,gameId,pid,channelId,token,uid,uname,time)
     -> 返回 wsAddress + playerId + token
  4. WebSocket连接 wsAddress
     发送 S_PLAYER_LOGIN (token, language, liveShowType)
```

### WebSocket协议格式
```
消息头 (18字节):
  - Header: 29099 (2字节, 固定魔数)
  - Length: 50 (4字节, 消息体长度)
  - MsgId:   (4字节, 协议ID)
  - PlayerId: (8字节, 玩家ID)

消息体:
  - Protobuf 编码的消息数据
```

### 游戏服务器URL模式
```
Login API:  https://proxy-xddq-cn.ap3615.com/s{serverId}_http/player/login
WebSocket:  (由login响应返回 wsAddress)
ServerList: https://login-xddq-cn.ap3615.com/server/list
```

---

## 四、游戏配置结构

平台支持的自动化功能配置(与现有 account.json 一致):

```javascript
{
  // 砍树/斩龙
  chopTree: {
    enabled, levelOffset,
    main: { primaryAttribute, secondaryAttribute },
    stop: { num, doNum, level },
    separation: { quality, fightValueFirst, condition, strictMode, strictConditions }
  },

  // 天赋/血脉
  talent: {
    enabled,
    main: { attribute, skillId },
    stop: { stopNum, doNum },
    separation: { quality }
  },

  // 英雄榜
  herorank: {
    buyTickets: [bool*7],  // 每天是否购买次数
    fightDaily,            // 每日挑战
    robRanking,            // 抢夺排名
    rankLikeRange          // 排名点赞范围
  },

  // 福地
  homeland: {
    enabled, autoHarvest, backLike, buildingUpgradeAd,
    freeRaffle, payTribute, pray,
    rules: [itemId*5],     // 偷取物品规则
    xianYuSteal, xianYuNum,
    rankType, rankLikeRange
  },

  // 家园
  land: {
    enabled, autoPlant, autoCook, autoFert,
    autoSteal, autoDailyReword, autoSelectRoom,
    plantMode, flowers, specificFlowerIds, maxFlowerLevel,
    delayedCollect, matureInstantCollect,
    stolenThreeTimesCollect, stealRecord, stolenRank
  },

  // 活动
  activity: { enabled, index },
  wildBoss: { enabled, atkCount },
  gatherEnergy: { enabled },
  invade: { enabled, invadeIndex },
  starTrial: { enabled },
  pupil: { enabled },
  holyLand: { enabled },
  career: { enabled },
  townDemon: { enabled },
  tribulation: { enabled },
  skyWar: { enabled },

  // 投资
  investGame: { enabled, gameId: [], riskMode, showLog },

  // 其他
  unionConfig: { buyUnionGoodLists, unionBargainNum, unionBargainPrice }
}
```

---

## 五、渠道平台枚举

```javascript
Platforms = {
  QQ: 'qq',
  DOUYIN: 'douyin',    // 抖音
  VIVO: 'vivo',
  OPPO: 'oppo',
  XIAOMI: 'xiaomi',    // 小米
  ALIPAY: 'zfb',       // 支付宝
  HUAWEI: 'huawei',    // 华为
  WECHAT: 'wechat',    // 微信
  APP: 'app',
}
```

---

## 六、容器状态系统

平台使用 Kubernetes 管理游戏脚本容器,容器状态:
- `Pending` - 排队中
- `Running` - 运行中
- `Succeeded` - 已完成
- `Failed` - 失败
- `Unknown` - 未知

每个用户有基础配额 (baseQuotaPerMonth: 30天),容器到期自动停止。

---

## 七、与现有项目的关系

该项目 (xddq.sea666.cn) 本质上是现有 `xddq-assistant` 开源项目的**商业化托管版本**:
- 后端添加了用户管理/计费系统
- 使用K8s容器隔离多用户
- 提供了多主题的Web UI
- 支持多平台/多渠道登录
- 游戏协议核心与开源版一致

如果想要复制这个网站,需要的组件:
1. **前端**: React SPA (已分析的JS/CSS)
2. **后端API**: Node.js/Express + 数据库
3. **容器管理**: Kubernetes API集成
4. **游戏协议**: 与现有项目相同的37.com SDK + WebSocket
