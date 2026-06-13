import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

const DAILY_BATTLE_MAX = 20;
const DAILY_REPEAT_MAX = 1;

export default class CareerMgr {
  constructor() {
    this.isProcessing = false;
    this.enabled = false;

    this.careerType = 0;
    this.maxTalentNode = null;
    this.changeCareerTimesToday = 0;
    this.bossData = null;
    this.firstSwitchCareerTime = 0;

    this.lastActionTime = 0;
    this.actionCooldown = 3000;
    this.lastTaskRewardTime = 0;

    // 主动查询间隔
    this.lastQueryTime = 0;
    this.queryCooldown = 30000;

    RegistMgr.inst.add(this);
  }

  static get inst() {
    if (!this._instance) {
      this._instance = new CareerMgr();
    }
    return this._instance;
  }

  reset() {
    this._instance = null;
  }

  clear() {
    LoopMgr.inst.remove(this);
  }

  // ==================== 消息处理 ====================

  onPlayerDataSync(msgData) {
    if (!msgData) return;
    this.careerType = msgData.careerType || 0;
    this.maxTalentNode = msgData.maxTalentNode || null;
    this.changeCareerTimesToday = msgData.changeCareerTimesToday || 0;
    this.bossData = msgData.bossData || { hasPassBossId: 0, battleTimesToday: 0, repeatTimesToday: 0 };
    this.firstSwitchCareerTime = Number(msgData.firstSwitchCareerTime) || 0;

    const careerName = this.careerType === 1 ? "仙道" : this.careerType === 2 ? "魔道" : "未选择";
    logger.info(
      `[道途管理] 数据同步: 道途=${careerName}, boss进度=${this.bossData.hasPassBossId}, ` +
      `今日挑战=${this.bossData.battleTimesToday}/${DAILY_BATTLE_MAX}, 今日扫荡=${this.bossData.repeatTimesToday}/${DAILY_REPEAT_MAX}`
    );
  }

  onBossAttrResp(msgData) {
    logger.info(`[道途管理] Boss属性响应: ${JSON.stringify(msgData).substring(0, 300)}`);

    // 响应中可能包含boss进度数据
    if (msgData.bossData) {
      this.bossData = msgData.bossData;
    }
    if (msgData.careerType != null) {
      this.careerType = msgData.careerType;
    }
    if (msgData.maxTalentNode) {
      this.maxTalentNode = msgData.maxTalentNode;
    }

    // 如果没有bossData但有battleTimesToday，构建bossData
    if (!this.bossData && (msgData.battleTimesToday != null || msgData.hasPassBossId != null)) {
      this.bossData = {
        hasPassBossId: msgData.hasPassBossId || msgData.bossId || 0,
        battleTimesToday: msgData.battleTimesToday || 0,
        repeatTimesToday: msgData.repeatTimesToday || 0,
      };
    }
  }

  onBattleBossResp(msgData) {
    if (msgData.ret && msgData.ret !== 0) {
      logger.warn(`[道途管理] boss挑战返回错误 ret=${msgData.ret}`);
      return;
    }

    if (msgData.bossData) {
      this.bossData = msgData.bossData;
    } else if (this.bossData) {
      // 服务器没返回bossData时，本地计数器+1
      this.bossData.battleTimesToday = (this.bossData.battleTimesToday || 0) + 1;
    }
    if (msgData.maxTalentNode) {
      this.maxTalentNode = msgData.maxTalentNode;
    }

    logger.info(
      `[道途管理] boss操作成功: 今日挑战=${this.bossData?.battleTimesToday}/${DAILY_BATTLE_MAX}, ` +
      `扫荡=${this.bossData?.repeatTimesToday}/${DAILY_REPEAT_MAX}`
    );
  }

  onTrainResp(msgData) {
    if (msgData.ret && msgData.ret !== 0) {
      logger.warn(`[道途管理] 修行返回错误 ret=${msgData.ret}`);
      return;
    }

    if (msgData.maxTalentNode) {
      this.maxTalentNode = msgData.maxTalentNode;
      logger.info(`[道途管理] 修行成功: talentId=${this.maxTalentNode.talentId}, lv=${this.maxTalentNode.lv}`);
    } else {
      logger.info("[道途管理] 修行成功");
    }
  }

  onPreTaskRewardResp(msgData) {
    if (msgData.ret && msgData.ret !== 0) {
      logger.warn(`[道途管理] 任务奖励领取返回错误 ret=${msgData.ret}`);
      return;
    }
    logger.info("[道途管理] 任务奖励领取成功");
  }

  // 18001 切换道途响应
  onSwitchCareerResp(msgData) {
    if (msgData.ret && msgData.ret !== 0) {
      logger.warn(`[道途管理] 切换道途返回错误 ret=${msgData.ret}`);
      return;
    }
    logger.info("[道途管理] 切换道途成功");
    this.lastQueryTime = 0;
    this.bossData = null;
  }

  // 18006 获取道途属性映射响应
  onGetAttrMapResp(msgData) {
    if (msgData.ret && msgData.ret !== 0) {
      logger.warn(`[道途管理] 获取属性映射返回错误 ret=${msgData.ret}`);
      return;
    }
    logger.info(`[道途管理] 获取属性映射成功`);
  }

  // ==================== 请求发送 ====================

  requestQuery() {
    logger.info("[道途管理] 主动查询道途数据...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_PROFESSION_GET_BOSS_ATTR, {});
  }

  requestBattleBoss() {
    logger.info("[道途管理] 挑战boss...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_PROFESSION_BATTLE_BOSS, {});
  }

  requestSweep() {
    logger.info("[道途管理] 扫荡boss...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_PROFESSION_BATTLE_BOSS, { repeat: true });
  }

  requestTrain() {
    logger.info("[道途管理] 修行加点...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_PROFESSION_TRAIN, {});
  }

  requestTaskReward() {
    logger.info("[道途管理] 领取任务奖励...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_PROFESSION_GET_TASK_REWARD, {});
  }

  // ==================== 核心逻辑 ====================

  async loopUpdate() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.enabled = global.account.switch?.career ?? false;
      if (!this.enabled) {
        this.clear();
        return;
      }

      const now = Date.now();
      if (now - this.lastActionTime < this.actionCooldown) return;

      // 如果没有数据，主动查询（每30秒一次）
      if (!this.bossData) {
        if (now - this.lastQueryTime > this.queryCooldown) {
          this.lastQueryTime = now;
          this.lastActionTime = now;
          this.requestQuery();
        }
        return;
      }

      const { battleTimesToday = 0, repeatTimesToday = 0 } = this.bossData;

      // 1. 领取任务奖励（每5分钟检查一次）
      if (now - this.lastTaskRewardTime > 5 * 60 * 1000) {
        this.lastTaskRewardTime = now;
        this.requestTaskReward();
        this.lastActionTime = now;
        return;
      }

      // 2. 先查询boss属性再挑战
      if (battleTimesToday < DAILY_BATTLE_MAX) {
        if (!this._queriedBeforeFight) {
          this._queriedBeforeFight = true;
          this.requestQuery();
        } else {
          this._queriedBeforeFight = false;
          this.requestBattleBoss();
        }
        this.lastActionTime = now;
        return;
      }

      // 3. 扫荡（每天1次，在20次挑战之后）
      if (repeatTimesToday < DAILY_REPEAT_MAX) {
        this.requestSweep();
        this.lastActionTime = now;
        return;
      }

      // 4. 修行加点
      this.requestTrain();
      this.lastActionTime = now;
    } catch (error) {
      logger.error(`[道途管理] 异常: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
