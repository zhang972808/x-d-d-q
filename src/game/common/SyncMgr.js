import WebSocket, { WebSocketServer } from "ws";
import logger from "#utils/logger.js";

// 需要同步的消息ID（战斗/活动/事件类操作）
const SYNC_MSG_IDS = new Set([
  // 战斗类
  20402,  // 关卡挑战
  20732,  // 妖王挑战
  20762,  // 镇妖塔挑战
  21401,  // 异兽入侵挑战
  25602,  // 真火秘境战斗
  23703,  // 群英榜挑战
  206902, // 星宿试炼挑战
  209101, // 法则试练挑战
  208403, // 征战诸天决斗（打城）
  208402, // 征战诸天刷新
  25805,  // 妖盟讨伐战斗
  5803,   // 妖盟讨伐奖励
  // 活动
  21003,  // 活动获取数据
  21004,  // 活动领取条件奖励
  21022,  // 活动批量领取奖励
  21005,  // 活动购买
  21013,  // 活动抽奖
  21001,  // 活动同步主配置
  // 仙宫
  24802,  // 仙宫点赞
  24806,  // 仙宫送福
  // 聚灵阵
  207007, // 聚灵阵战斗
  // 征战诸天其他
  208404, // 征战诸天排行榜
  208410, // 征战诸天膜拜
  // 妖盟悬赏
  213604, // 掠夺
  213620, // 攻击怪物
]);

const MASTER_PORT = 8099;

class SyncMgr {
  constructor() {
    this.enabled = false;
    this.isMaster = false;
    this.isSlave = false;
    this.wss = null;
    this.ws = null;
    this.clients = new Set();
    // 外部注入的 sendPbMsg 回调，子账号收到命令后调用
    this._sendFn = null;
  }

  static get inst() {
    if (!this._instance) this._instance = new SyncMgr();
    return this._instance;
  }

  reset() {
    if (this.wss) { this.wss.close(); this.wss = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.clients.clear();
    this.enabled = false;
    this.isMaster = false;
    this.isSlave = false;
    this._sendFn = null;
    SyncMgr._instance = null;
  }

  // 注入发送函数，避免循环依赖
  setSendFn(fn) { this._sendFn = fn; }

  // 主账号：启动命令广播服务器
  startAsMaster() {
    if (this.enabled) return;
    this.isMaster = true;
    this.enabled = true;
    this.wss = new WebSocketServer({ port: MASTER_PORT });
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      logger.info(`[同步管理] 子账号已连接 (${this.clients.size}个)`);
      ws.on("close", () => {
        this.clients.delete(ws);
        logger.info(`[同步管理] 子账号断开 (剩余${this.clients.size}个)`);
      });
    });
    logger.info("[同步管理] 主控模式启动，端口 8099");
  }

  // 子账号：连接主账号接收命令
  startAsSlave() {
    if (this.enabled) return;
    this.isSlave = true;
    this.enabled = true;
    this._connect();
  }

  _connect() {
    if (this.ws) { try { this.ws.close(); } catch(e) {} }
    this.ws = new WebSocket(`ws://localhost:${MASTER_PORT}`);
    this.ws.on("open", () => {
      logger.info("[同步管理] 已连接主账号");
    });
    this.ws.on("message", (data) => {
      try {
        const { msgId, msgData } = JSON.parse(data.toString());
        logger.debug(`[同步管理] 执行主控命令 msgId=${msgId}`);
        if (this._sendFn) {
          this._sendFn(msgId, msgData);
        }
      } catch (e) {
        logger.error(`[同步管理] 命令解析失败: ${e.message}`);
      }
    });
    this.ws.on("close", () => {
      logger.warn("[同步管理] 主控连接断开，3秒后重连...");
      setTimeout(() => this._connect(), 3000);
    });
    this.ws.on("error", () => {}); // close事件会处理
  }

  // 主账号：广播操作给所有子账号
  broadcast(msgId, msgData) {
    if (!this.isMaster || this.clients.size === 0) return;
    if (!SYNC_MSG_IDS.has(msgId)) return;

    const payload = JSON.stringify({ msgId, msgData });
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }
}

export default SyncMgr;
export { MASTER_PORT, SYNC_MSG_IDS };
