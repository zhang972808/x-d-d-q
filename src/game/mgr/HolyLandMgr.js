import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";
import ActivityMgr from "#game/mgr/ActivityMgr.js";

/**
 * 幽冥战场 (九幽争霸 / HolyLand) 管理器
 *
 * 功能：
 * 1. 首页自动检测幽冥战场活动是否开启（通过ActivityMgr活动数据和登录同步消息）
 * 2. 活动开启后自动打开地图（进入游戏场景）
 * 3. 跟随妖盟集结标记自动行军攻打城池
 * 4. 每日购买免费和仙玉礼包
 * 5. 保持活动心跳
 * 6. 阵亡自动处理
 */

// 活动阶段常量
const PHASE = {
  NONE: 0,       // 未开启
  REGISTER: 1,   // 报名阶段
  GROUP: 2,      // 小组赛
  KNOCKOUT: 3,   // 淘汰赛
  FINAL: 4,      // 决赛
  SETTLE: 5,     // 结算
};

// 检查间隔（毫秒）
const CHECK_INTERVAL = 30 * 1000;
// 心跳间隔（毫秒）
const HEARTBEAT_INTERVAL = 60 * 1000;
// 礼包购买检查间隔（毫秒）
const PACK_CHECK_INTERVAL = 60 * 60 * 1000;
// 目标城市轮询间隔（毫秒）— 普通成员收不到指挥官设目标的广播，需要主动轮询
const TARGET_POLL_INTERVAL = 5 * 1000;

export default class HolyLandMgr {
  constructor() {
    this.enabled = false;
    this.isProcessing = false;

    // 活动状态
    this.phase = PHASE.NONE;
    this.isActivityOpen = false;
    this.isInGame = false;
    this.hasEnteredGame = false; // 是否已请求过进入游戏（防重复）

    // 检测到的幽冥战场相关活动ID列表
    this.holyLandActivityIds = [];

    // 时间戳（由 HolyLandBattleTimeStampsDataSync 下发）
    this.timeStamps = null;

    // 游戏内状态
    this.myGameInfo = null;
    // 是否被击杀（需要处理复活等）
    this.isDead = false;

    // 检查计时
    this.lastCheckTime = 0;
    this.lastHeartbeatTime = 0;
    this.lastPackCheckTime = 0;
    this.lastTargetPollTime = 0;

    // 礼包购买记录 { packId: lastBuyDay }
    this.packBuyRecord = {};

    RegistMgr.inst.add(this);
  }

  static get inst() {
    if (!this._instance) {
      this._instance = new HolyLandMgr();
    }
    return this._instance;
  }

  reset() {
    this._instance = null;
  }

  clear() {
    LoopMgr.inst.remove(this);
  }

  // ==================== 消息处理（由 MsgRecvMgr 调用） ====================

  // 活动基础数据响应
  onBaseInfoResp(msgData) {
    logger.info(`[幽冥战场] 活动基础数据: ${JSON.stringify(msgData).substring(0, 500)}`);

    if (msgData.phase != null) {
      this.phase = msgData.phase;
    }
    if (msgData.stage != null) {
      this.phase = msgData.stage;
    }

    // 根据响应中的状态判断活动是否开启
    this.isActivityOpen = msgData.isOpen
      || msgData.activityOpen
      || msgData.status > 0
      || true;

    if (this.isActivityOpen) {
      logger.info(`[幽冥战场] 活动已开启, phase=${this.phase}`);
    }
  }

  // 登录时下发的时间戳数据
  onTimeStampsSync(msgData) {
    this.timeStamps = msgData;
    this.isActivityOpen = true;
    logger.info(`[幽冥战场] 赛事时间戳同步: ${JSON.stringify(msgData).substring(0, 500)}`);
  }

  // 登录时下发的报名数据
  onApplyDataSync(msgData) {
    logger.info(`[幽冥战场] 报名数据同步: ${JSON.stringify(msgData).substring(0, 500)}`);
    this.isActivityOpen = true;
  }

  // 进入游戏响应
  onGameInfoResp(msgData) {
    logger.info(`[幽冥战场] 打开地图响应: ${JSON.stringify(msgData).substring(0, 500)}`);
    if (msgData.ret === 0 || msgData.ret == null) {
      this.isInGame = true;
      logger.info("[幽冥战场] 已打开地图，进入幽冥战场");
    } else {
      logger.warn(`[幽冥战场] 打开地图失败: ret=${msgData.ret}`);
      this.hasEnteredGame = false;
      // 进入失败，清理优先队列
      WorkFlowMgr.inst.remove("HolyLand");
    }
  }

  // 玩家游戏信息同步
  onMyGameInfoSync(msgData) {
    this.myGameInfo = msgData;
    this.isInGame = true;
  }

  // 被击杀通知
  onBeenKilled(msgData) {
    logger.info(`[幽冥战场] 被击杀: ${JSON.stringify(msgData).substring(0, 300)}`);
    this.isDead = true;
  }

  // 目标城市信息响应（轮询集结目标）
  onTargetCityInfoResp(msgData) {
    const targetCityId = msgData.cityId
      || msgData.targetCityId
      || msgData.unionTargetId
      || msgData.targetCityIndex
      || msgData.id;
    const lineId = msgData.lineId
      || msgData.routeId
      || msgData.targetLineId
      || msgData.routeIndex;

    if (targetCityId != null) {
      logger.info(`[幽冥战场] 收到集结目标: cityId=${targetCityId}, lineId=${lineId}`);
      GameNetMgr.inst.sendPbMsg(Protocol.S_HOLY_LAND_GAME_MOVE, {
        playerId: UserMgr.playerId,
        cityId: targetCityId,
        lineId: lineId || 0,
      });
      setTimeout(() => {
        GameNetMgr.inst.sendPbMsg(Protocol.S_HOLY_LAND_GAME_AUTO_ATTACK, {
          playerId: UserMgr.playerId,
        });
        logger.info(`[幽冥战场] 自动攻击目标城市 ${targetCityId}`);
      }, 5000);
    }
  }

  // ==================== 活动检测 ====================

  // 从 ActivityMgr 检查幽冥战场相关活动是否开启
  // 活动数据通过登录时 ActivityMgr.SyncData / ActivityCommonDataListSync 下发
  checkActivityFromActivityMgr() {
    const actMap = ActivityMgr.inst.actMainConfigMap;
    const now = Date.now();

    this.holyLandActivityIds = [];

    for (const [activityId, config] of Object.entries(actMap)) {
      const name = (config?.name || config?.activityName || "").toLowerCase();
      // 匹配九幽/HolyLand相关的活动名称或类型ID
      if (name.includes("九幽") || name.includes("holy") || name.includes("幽冥")) {
        // 检查时间范围
        const beginTime = config.beginTime;
        const endTime = config.endTime;
        if (beginTime && endTime) {
          const isActive = now >= Number(beginTime) && now <= Number(endTime);
          if (isActive) {
            this.holyLandActivityIds.push(activityId);
            logger.info(`[幽冥战场] 检测到活动: id=${activityId}, name=${name}, begin=${new Date(Number(beginTime)).toLocaleString()}, end=${new Date(Number(endTime)).toLocaleString()}`);
          }
        }
      }
    }

    if (this.holyLandActivityIds.length > 0) {
      this.isActivityOpen = true;
      logger.info(`[幽冥战场] 检测到 ${this.holyLandActivityIds.length} 个幽冥战场相关活动已开启`);
      return true;
    }

    return false;
  }

  // 获取 HolyLand 相关的活动 ID
  getHolyLandActivityIds() {
    if (this.holyLandActivityIds.length > 0) {
      return this.holyLandActivityIds;
    }

    // 回退：从 ActivityMgr 中搜索
    const ids = [];
    Object.keys(ActivityMgr.inst.actMainConfigMap).forEach((id) => {
      const config = ActivityMgr.inst.actMainConfigMap[id];
      const name = (config?.name || config?.activityName || "").toLowerCase();
      if (name.includes("九幽") || name.includes("holy") || name.includes("幽冥")) {
        ids.push(id);
      }
    });
    return ids;
  }

  // ==================== 核心逻辑 ====================

  // 检测是否应该进入游戏
  shouldEnterGame() {
    if (this.hasEnteredGame) return false;
    if (this.isInGame) return false;
    if (!this.isActivityOpen) return false;

    // 有时间戳数据时，检查是否在战斗阶段内
    if (this.timeStamps) {
      const now = Date.now();
      const battleStart = this.timeStamps.battleStartTime
        || this.timeStamps.gameStartTime
        || this.timeStamps.startTime
        || 0;
      const battleEnd = this.timeStamps.battleEndTime
        || this.timeStamps.gameEndTime
        || this.timeStamps.endTime
        || Infinity;

      if (now < battleStart) {
        logger.info(`[幽冥战场] 战斗尚未开始，开始时间: ${new Date(Number(battleStart)).toLocaleString()}`);
        return false;
      }
      if (now > battleEnd) {
        logger.info(`[幽冥战场] 战斗已结束，结束时间: ${new Date(Number(battleEnd)).toLocaleString()}`);
        this.hasEnteredGame = true; // 标记已处理过，本次不再进入
        return false;
      }
    }

    return true;
  }

  // 打开地图（进入幽冥战场游戏场景）
  enterGame() {
    logger.info("[幽冥战场] 检测到活动开启，正在打开地图进入幽冥战场...");
    this.hasEnteredGame = true;

    // 将幽冥战场加入优先队列，阻塞低优先级任务
    WorkFlowMgr.inst.add("HolyLand");
    logger.info("[幽冥战场] 已提升为高优先级任务，将阻塞征战诸天、闯关等低优先级任务");

    GameNetMgr.inst.sendPbMsg(Protocol.S_HOLY_LAND_GAME_INFO_LOAD, {
      playerId: UserMgr.playerId,
    });
  }

  // 退出幽冥战场（活动结束或被踢出）
  exitGame() {
    logger.info("[幽冥战场] 退出幽冥战场");
    this.isInGame = false;
    this.hasEnteredGame = false;

    // 从优先队列移除
    WorkFlowMgr.inst.remove("HolyLand");
  }

  // 发送活动心跳
  sendHeartbeat() {
    GameNetMgr.inst.sendPbMsg(Protocol.S_HOLY_LAND_GAME_HEART_BEAT, {
      playerId: UserMgr.playerId,
    });
  }

  // 请求活动基础数据
  requestBaseInfo() {
    GameNetMgr.inst.sendPbMsg(Protocol.S_HOLY_LAND_BASE_INFO_LOAD, {
      playerId: UserMgr.playerId,
    });
  }

  // 轮询目标城市信息（普通成员收不到指挥官设目标的广播，需要主动拉取）
  pollTargetCityInfo() {
    GameNetMgr.inst.sendPbMsg(Protocol.S_HOLY_LAND_GAME_TARGET_CITY_INFO, {
      playerId: UserMgr.playerId,
    });
  }

  // 检查活动是否仍然活跃（用于退出检测）
  checkActivityStillActive() {
    if (!this.isActivityOpen) return false;

    // 通过 ActivityMgr 再次检查
    const actMap = ActivityMgr.inst.actMainConfigMap;
    const now = Date.now();
    let foundActive = false;

    for (const [activityId, config] of Object.entries(actMap)) {
      const name = (config?.name || config?.activityName || "").toLowerCase();
      if (name.includes("九幽") || name.includes("holy") || name.includes("幽冥")) {
        const beginTime = config.beginTime;
        const endTime = config.endTime;
        if (beginTime && endTime) {
          if (now >= Number(beginTime) && now <= Number(endTime)) {
            foundActive = true;
            break;
          }
        }
      }
    }

    // 如果有时间戳，也检查时间戳
    if (this.timeStamps) {
      const battleEnd = this.timeStamps.battleEndTime
        || this.timeStamps.gameEndTime
        || this.timeStamps.endTime
        || Infinity;
      if (now > battleEnd) {
        return false;
      }
      foundActive = true;
    }

    return foundActive || this.isActivityOpen;
  }

  // ==================== 礼包购买 ====================

  // 购买每日礼包
  buyDailyPacks() {
    const today = new Date().toDateString();

    const holyLandActivityIds = this.getHolyLandActivityIds();
    holyLandActivityIds.forEach((activityId) => {
      const detailConfig = ActivityMgr.inst.actDetailConfigMap[activityId];
      if (!detailConfig) return;

      const mallConfig = detailConfig?.commonConfig?.mallConfig || [];
      mallConfig.forEach((mallItem) => {
        const mallTempMsg = mallItem?.mallTempMsg;
        if (!mallTempMsg) return;

        const packKey = `${activityId}_${mallTempMsg.id}`;
        if (this.packBuyRecord[packKey] === today) return;

        const price = mallTempMsg.price || "";
        const [costItemId, costAmount] = price.split("=").map(Number);

        // 免费礼包 (price = "100000=0")
        if (price === "100000=0") {
          this.buyPack(activityId, mallTempMsg.id, packKey, today, "免费");
          return;
        }

        // 仙玉礼包 (costItemId 100001 通常是仙玉)
        if (costItemId === 100001 && costAmount > 0) {
          const limit = global.account.holyLand?.maxJadeCost || 0;
          if (costAmount <= limit) {
            this.buyPack(activityId, mallTempMsg.id, packKey, today, `仙玉${costAmount}`);
          }
          return;
        }
      });
    });
  }

  buyPack(activityId, mallId, packKey, today, desc) {
    logger.info(`[幽冥战场] 购买${desc}礼包: activityId=${activityId}, mallId=${mallId}`);
    GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_BUY_MALL_GOODS, {
      data: { activityId, mallId, count: 1, isUseADTime: false },
    });
    this.packBuyRecord[packKey] = today;
  }

  // ==================== 循环更新 ====================

  async loopUpdate() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.enabled = global.account.switch?.holyLand ?? false;
      if (!this.enabled) {
        this.clear();
        return;
      }

      const now = Date.now();

      // 1. 首页检测：从 ActivityMgr 检查幽冥战场活动是否开启
      if (!this.isActivityOpen) {
        this.checkActivityFromActivityMgr();
      }

      // 2. 检测到活动开启，立即尝试进入游戏
      if (this.shouldEnterGame()) {
        this.enterGame();
      }

      // 3. 检测活动是否已结束
      if (this.isActivityOpen && this.isInGame) {
        const stillActive = this.checkActivityStillActive();
        if (!stillActive) {
          logger.info("[幽冥战场] 活动已结束，退出幽冥战场");
          this.exitGame();
        }
      }

      // 4. 定期检查活动状态（请求基础数据、发送心跳）
      if (now - this.lastCheckTime >= CHECK_INTERVAL) {
        this.lastCheckTime = now;

        // 还未检测到活动，请求基础数据
        if (!this.isActivityOpen) {
          this.requestBaseInfo();
        }

        // 在游戏中发送心跳
        if (this.isInGame && now - this.lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
          this.lastHeartbeatTime = now;
          this.sendHeartbeat();
        }
      }

      // 4.5 在游戏中定期轮询目标城市（跟随集结的关键——普通成员收不到指挥官广播）
      if (this.isInGame && now - this.lastTargetPollTime >= TARGET_POLL_INTERVAL) {
        this.lastTargetPollTime = now;
        this.pollTargetCityInfo();
      }

      // 6. 定期检查礼包
      if (now - this.lastPackCheckTime >= PACK_CHECK_INTERVAL) {
        this.lastPackCheckTime = now;
        this.buyDailyPacks();
      }
    } catch (error) {
      logger.error(`[幽冥战场] 异常: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
