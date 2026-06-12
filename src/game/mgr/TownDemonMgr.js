import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";

const STATE = {
  IDLE: "idle",
  ENTERING: "entering",
  BATTLING: "battling",
  CLAIMING_ACHIEVE: "claimingAchieve",
  GETTING_RANK_REWARD: "gettingRankReward",
  CLAIMING_RANK_REWARD: "claimingRankReward",
  COOLDOWN: "cooldown",
};

export default class TownDemonMgr {
  constructor() {
    this.enabled = false;
    this.isProcessing = false;

    this.isActivityOpen = false;
    this.state = STATE.IDLE;

    this.applyData = null;
    this.timeStamps = null;
    this.achieveList = [];

    // 挑战相关
    this.lastBattleTime = 0;
    this.battleCooldown = 3000; // 战斗间隔 3 秒
    this.consecutiveFailures = 0;
    this.maxFailures = 3;

    this.lastCheckTime = 0;
  }

  static get inst() {
    if (!this._instance) {
      this._instance = new TownDemonMgr();
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

  onApplyDataSync(msgData) {
    this.applyData = msgData;
    if (msgData.isOpen === true) {
      this.isActivityOpen = true;
    }
    logger.info(`[镇魔] 登录同步: isOpen=${msgData.isOpen}, roundId=${msgData.roundId}`);
  }

  onTimeStampsSync(msgData) {
    this.timeStamps = msgData;
    logger.info(`[镇魔] 时间戳同步: ${JSON.stringify(msgData).substring(0, 300)}`);
  }

  onBaseInfoResp(msgData) {
    logger.info(`[镇魔] 活动主界面响应: ${JSON.stringify(msgData).substring(0, 500)}`);
    if (this.state === STATE.ENTERING) {
      // 进入成功，准备挑战
      this.state = STATE.BATTLING;
      this.consecutiveFailures = 0;
    }
  }

  onBattleResp(msgData) {
    logger.info(`[镇魔] 挑战结果: ${JSON.stringify(msgData).substring(0, 500)}`);

    // ret != 0 可能表示没次数了或活动结束了
    if (msgData.ret && msgData.ret !== 0) {
      logger.warn(`[镇魔] 挑战返回错误 ret=${msgData.ret}`);
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.maxFailures) {
        logger.info("[镇魔] 连续失败，暂停挑战");
        this.state = STATE.COOLDOWN;
      } else {
        this.state = STATE.ENTERING;
      }
      return;
    }

    this.consecutiveFailures = 0;
    this.lastBattleTime = Date.now();

    // 挑战成功后，领取成就奖励
    this.state = STATE.CLAIMING_ACHIEVE;
    this.requestAchieveInfo();
  }

  onAchieveInfoResp(msgData) {
    logger.info(`[镇魔] 成就信息: ${JSON.stringify(msgData).substring(0, 500)}`);
    this.achieveList = msgData.achieveDataList || msgData.achieveList || msgData.list || [];
    this.claimNextAchieve();
  }

  onAchieveRewardResp(msgData) {
    logger.info(`[镇魔] 成就奖励领取: ${JSON.stringify(msgData).substring(0, 300)}`);
    if (msgData.ret === 0 || msgData.ret == null) {
      this.claimNextAchieve();
    } else {
      logger.info("[镇魔] 成就奖励已全部领取");
      // 成就领完后，尝试领排行奖励
      this.state = STATE.GETTING_RANK_REWARD;
      this.requestRewardInfo();
    }
  }

  onRewardInfoResp(msgData) {
    logger.info(`[镇魔] 排行奖励信息响应: ${JSON.stringify(msgData).substring(0, 300)}`);
    const info = msgData || {};
    const canClaim =
      info.canReceiveRankReward ||
      info.hasRankReward ||
      (info.rank != null && info.rank > 0);
    if (canClaim) {
      this.state = STATE.CLAIMING_RANK_REWARD;
      this.claimRankReward(info);
    } else {
      logger.info("[镇魔] 暂时没有排行奖励可领取，继续挑战");
      // 没有排行奖励就继续挑战
      if (this.consecutiveFailures < this.maxFailures) {
        this.state = STATE.ENTERING;
      } else {
        this.state = STATE.COOLDOWN;
      }
    }
  }

  onRankRewardResp(msgData) {
    logger.info(`[镇魔] 排行奖励领取: ${JSON.stringify(msgData).substring(0, 300)}`);
    // 领完后继续挑战
    if (this.consecutiveFailures < this.maxFailures) {
      this.state = STATE.ENTERING;
    } else {
      this.state = STATE.COOLDOWN;
    }
  }

  // ==================== 请求发送 ====================

  requestBaseInfo() {
    logger.info("[镇魔] 请求活动主界面...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_SUPPRESSDEMON_BASE_INFO_LOAD, {});
  }

  requestBattle() {
    logger.info("[镇魔] 发起挑战...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_SUPPRESSDEMON_BATTLE, {});
  }

  requestAchieveInfo() {
    logger.info("[镇魔] 获取成就信息...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_SUPPRESSDEMON_GET_ACHIEVE_INFO, {});
  }

  claimNextAchieve() {
    const achieve = this.achieveList.find(
      (a) => a.canReceive || a.status === 1 || (a.status != null && a.status !== 2)
    );
    if (achieve) {
      const id = achieve.achieveId || achieve.id || achieve.index || 0;
      logger.info(`[镇魔] 领取成就奖励 id=${id}`);
      GameNetMgr.inst.sendPbMsg(Protocol.S_SUPPRESSDEMON_ACHIEVE_REWARD, {
        achieveId: id,
      });
    } else {
      logger.info("[镇魔] 没有可领取的成就奖励");
      this.state = STATE.GETTING_RANK_REWARD;
      this.requestRewardInfo();
    }
  }

  requestRewardInfo() {
    logger.info("[镇魔] 获取排行奖励信息...");
    GameNetMgr.inst.sendPbMsg(Protocol.S_SUPPRESSDEMON_GET_REWARD_INFO, {});
  }

  claimRankReward(info) {
    logger.info("[镇魔] 领取排行奖励");
    GameNetMgr.inst.sendPbMsg(Protocol.S_SUPPRESSDEMON_GET_RANK_REWARD, {});
  }

  // ==================== 核心逻辑 ====================

  // 检查是否到了活动开始时间（固定10:00）
  isAfterOpenTime() {
    const now = new Date();
    if (now.getHours() >= 10) return true;

    if (this.timeStamps?.scheduleTimestamp) {
      const timestamps = this.timeStamps.scheduleTimestamp;
      if (Array.isArray(timestamps) && timestamps.length > 0) {
        return Date.now() / 1000 >= timestamps[0];
      }
    }

    return false;
  }

  async loopUpdate() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.enabled = global.account.switch?.townDemon ?? false;
      if (!this.enabled) {
        if (this.state !== STATE.IDLE) {
          this.state = STATE.IDLE;
        }
        return;
      }

      const now = Date.now();
      if (now - this.lastCheckTime < 5000) return;
      this.lastCheckTime = now;

      // 等10点
      if (!this.isAfterOpenTime()) return;

      switch (this.state) {
        case STATE.IDLE:
          // 不管 isActivityOpen 如何，到点了直接尝试进入
          this.state = STATE.ENTERING;
          this.requestBaseInfo();
          break;

        case STATE.ENTERING:
          // 等待 onBaseInfoResp
          break;

        case STATE.BATTLING:
          // 有冷却时间
          if (now - this.lastBattleTime < this.battleCooldown) return;
          this.requestBattle();
          break;

        case STATE.CLAIMING_ACHIEVE:
        case STATE.GETTING_RANK_REWARD:
        case STATE.CLAIMING_RANK_REWARD:
          // 等待服务器响应
          break;

        case STATE.COOLDOWN:
          // 冷却 60 秒后重新尝试
          if (now - this.lastBattleTime > 60000) {
            logger.info("[镇魔] 冷却结束，重新尝试挑战");
            this.consecutiveFailures = 0;
            this.state = STATE.ENTERING;
            this.requestBaseInfo();
          }
          break;
      }
    } catch (error) {
      logger.error(`[镇魔] 异常: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
