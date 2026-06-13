import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import PalaceMgr from "#game/mgr/PalaceMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";

export default class WildBossMgr {
    constructor() {
        this.enabled = global.account.switch.wildBoss??true;                              // 默认开启
        this.AD_REWARD_DAILY_MAX_NUM = 6 + (PlayerAttributeMgr.isMonthCardVip ? 2 : 0);   // 每日最大领取次数
        this.AD_REWARD_CD = 1000;                                                         // 每次间隔时间
        this.passId = 0;                                                                  // 当前通关妖王ID
        this.getAdRewardTimes = 0;                                                        // 今日已领取广告奖励次数
        this.lastAdRewardTime = 0;                                                        // 上次领取时间戳
        this.isProcessing = false;
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new WildBossMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    checkReward(t) {
        this.isProcessing = true;
        this.getAdRewardTimes = t.data.useRepeatTimes || 0;
        this.passId = t.data.passId || 0;
        this.lastAdRewardTime = 0;
        this.isProcessing = false;
    }

    challengeResult(t) {
        if (t.challengeSuccess) {
            logger.info("[挑战妖王管理] 挑战成功");
            GameNetMgr.inst.sendPbMsg(Protocol.S_WILDBOSS_SYNC, {}); // 同步妖王信息
        }
    }

    processReward() {
        const now = Date.now();

        if (this.passId < PlayerAttributeMgr.littleType) {
            logger.info("[挑战妖王管理] 可以挑战新的妖王，等待挑战结束后再领取奖励");
            GameNetMgr.inst.sendPbMsg(Protocol.S_WILDBOSS_CHALLENGE, {});
            return;
        }
        if (this.getAdRewardTimes < this.AD_REWARD_DAILY_MAX_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD) {
            if (SystemUnlockMgr.PALACE) {
                if (!PalaceMgr.inst.checkIsMiracle()) {
                    logger.info("[挑战妖王管理] 仙宫未开启");
                    return;
                }
            }
            logger.info(`[挑战妖王管理] 还剩 ${this.AD_REWARD_DAILY_MAX_NUM - this.getAdRewardTimes} 次`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_WILDBOSS_REPEAT, {});
            this.getAdRewardTimes++;
            this.lastAdRewardTime = now;
        }
    }

    async loopUpdate() {
        if (!this.enabled) {
            logger.info("[挑战妖王管理] 挑战妖王未开启");
            this.clear();
            return;
        }

        // 每日重置
        const today = new Date().toISOString().slice(0, 10);
        if (this._lastDay !== today) {
            this._lastDay = today;
            this.getAdRewardTimes = 0;
            this.lastAdRewardTime = 0;
        }

        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.getAdRewardTimes >= this.AD_REWARD_DAILY_MAX_NUM) {
                logger.info("[挑战妖王管理] 今日已达上限，明日继续");
            } else {
                this.processReward();
            }
        } catch (error) {
            logger.error(`[挑战妖王管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
