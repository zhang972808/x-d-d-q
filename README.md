# 寻道大千 自动化脚本

> 仅供技术学习交流使用  
> 基于 [xddq-assistant](https://github.com/gyn7561/xddq-assistant) 二次开发

## 环境要求

- Node.js >= 18
- npm 或 yarn

## 安装

```bash
git clone https://github.com/zhang972808/x-d-d-q.git
cd x-d-d-q
npm install
```

## 使用方式

### 方式一：管理服务器（推荐，支持多账号）

```bash
node server.js
```

启动管理服务器（默认端口 8080），提供 Web 管理界面：
- 浏览器打开 `http://服务器IP:8080`
- 在管理界面添加游戏账号并启动
- 支持多账号同时运行

### 方式二：单账号直接运行

```bash
node app.js "data/账号文件.json"
```

或使用默认配置：
```bash
node app.js
```

### 方式三：PM2 部署（服务器推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动管理服务器
pm2 start server.js --name server

# 查看运行状态
pm2 list

# 查看日志
pm2 logs server --lines 100 --nostream

# 重启
pm2 restart server
```

## 功能说明

### 日常任务（自动执行）

| 功能 | 说明 |
|------|------|
| 砍树 | 自动砍树，支持严格模式/妖力模式 |
| 灵脉 | 自动灵脉筛选装备 |
| 异兽入侵 | 每日 5 次自动挑战 |
| 挑战妖王 | 自动挑战 + 领取广告奖励 |
| 星宿试炼 | 自动挑战星宿 |
| 宗门 | 自动训练→毕业→招人→锤炼 |
| 道途 | 自动挑战 Boss 20 次→扫荡→修行 |
| 群英榜 | 每日自动打榜 |
| 镇妖塔 | 一键选择 buff + 自动挑战 |
| 征战诸天 | 自动挑战 5 场 |
| 镇魔 | 自动参与镇魔活动 |
| 斗法 | 券数量超过阈值自动打 |
| 福地 | 自动收获、派遣 |
| 妖盟寻宝 | 自动挖宝箱 |
| 妖盟广告 | 自动领取 |
| 活动 | 自动领取免费礼包和任务奖励 |
| 青蛙管理 | 自动领取广告奖励 |
| 灵兽 | 自动刷新 + 抓捕 |
| 邮件 | 自动领取奖励 |
| 仙树 | 自动升级 + 净瓶水加速 |
| 自动买桃 | 群英榜商店自动购买 |

### 挑战（需配置）

| 功能 | 说明 |
|------|------|
| 冒险推图 | 每天 6:00-8:00 北京时间窗口 |
| 镇妖塔 | 同上时间窗口 |
| 真火秘境 | 同上时间窗口 |

## 配置说明

### 开关配置（`account.json` 的 `switch` 字段）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `chopTree` | bool | false | 自动砍树 |
| `talent` | bool | false | 自动灵脉 |
| `invade` | bool | false | 异兽入侵 |
| `wildBoss` | bool | false | 挑战妖王 |
| `starTrial` | bool | false | 星宿试炼 |
| `pupil` | bool | false | 宗门 |
| `career` | bool | false | 道途 |
| `herorank` | bool | false | 群英榜 |
| `challenge` | number | 0 | 冒险/塔/真火次数(0=不挑战) |
| `skywar` | bool | false | 征战诸天 |
| `townDemon` | bool | false | 镇魔 |
| `ticket` | number | 0 | 斗法券触发数量 |
| `activity` | bool | false | 自动活动 |
| `gatherEnergy` | bool | false | 聚灵阵 |
| `homeland` | bool | false | 福地 |
| `challengeSuccessReset` | bool | false | 挑战成功重置次数 |

## 目录结构

```
├── app.js                  # 游戏脚本入口（单账号）
├── server.js               # 管理服务器入口（多账号）
├── account.json            # 单账号配置
├── data/                   # 多账号配置目录
├── src/
│   ├── game/
│   │   ├── mgr/            # 功能管理器
│   │   │   ├── ChapterMgr.js        # 冒险/关卡
│   │   │   ├── TowerMgr.js          # 镇妖塔
│   │   │   ├── SecretTowerMgr.js    # 真火秘境
│   │   │   ├── PlayerAttributeMgr.js # 砍树/灵脉/仙树
│   │   │   ├── BagMgr.js            # 背包/斗法
│   │   │   ├── CareerMgr.js         # 道途
│   │   │   ├── PupilMgr.js          # 宗门
│   │   │   ├── HeroRankMgr.js       # 群英榜
│   │   │   ├── InvadeMgr.js         # 异兽入侵
│   │   │   ├── WildBossMgr.js       # 挑战妖王
│   │   │   ├── StarTrialMgr.js      # 星宿试炼
│   │   │   ├── SkyWarMgr.js         # 征战诸天
│   │   │   ├── TownDemonMgr.js      # 镇魔
│   │   │   ├── ActivityMgr.js       # 活动
│   │   │   ├── PetMgr.js            # 灵兽
│   │   │   ├── FrogMgr.js           # 青蛙
│   │   │   ├── AdRewardMgr.js       # 广告
│   │   │   ├── MailMgr.js           # 邮件
│   │   │   ├── UnionTreasureMgr.js  # 妖盟寻宝
│   │   │   └── ...                  # 其他管理器
│   │   ├── net/             # 网络通信
│   │   │   ├── GameNetMgr.js        # WebSocket 连接管理
│   │   │   ├── Protocol.js          # 协议定义
│   │   │   └── ProtobufMgr.js       # Protobuf 编解码
│   │   └── common/          # 公共模块
│   │       ├── LoopMgr.js           # 任务循环调度
│   │       ├── WorkFlowMgr.js       # 工作流管理
│   │       ├── MsgRecvMgr.js        # 消息路由
│   │       ├── RegistMgr.js         # 管理器注册
│   │       └── SyncMgr.js           # 多账号同步
│   ├── server/              # 管理服务器
│   │   ├── server.js        # Express 服务
│   │   ├── processManager.js        # 进程管理
│   │   ├── database.js              # SQLite 数据库
│   │   ├── authRoutes.js            # 认证路由
│   │   ├── gameAccountRoutes.js     # 账号管理
│   │   └── ...
│   ├── loaders/             # 启动加载
│   └── utils/               # 工具函数
├── public/                  # Web 前端
│   ├── index.html           # 控制台页面
│   ├── login.html           # 登录页面
│   ├── loader/              # 配置页面
│   └── js/                  # 前端 JS
├── package.json
└── README.md
```

## 常见问题

### 被手机顶号
脚本检测到被顶号后会等待 5 分钟重连。

### 功能不生效
1. 检查 `account.json` 中对应开关是否为 `true`
2. 查看日志定位问题
3. 确保游戏系统已解锁对应功能

### 服务器部署后功能失效
1. 检查 PM2 进程状态：`pm2 list`
2. 查看错误日志：`pm2 logs app --lines 50 --nostream`
3. 确保代码已更新到最新：`git pull`
