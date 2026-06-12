import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import PlayerAttributeMgr from "./PlayerAttributeMgr.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";

export default class BagMgr {
    constructor() {
        this.bagData = [];
        this.mallBuyCountList = [];
        this.isProcessing = false;
        this.initialized = false;
        this.ticket = global.account.switch.ticket ?? 2;
        this.rankBattleState = "idle"; // idle | waiting | challenging
        this.lastTreeLvUpTime = 0; // 上次尝试升级仙树的时间
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new BagMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        this.bagData = [];
        this.rankBattleState = "idle";
        LoopMgr.inst.remove(this);
    }

    SyncBagMsg(t) {
        if (Array.isArray(t.bagData)) {
            t.bagData.forEach((newItem) => {
                const existingItem = this.bagData.find((item) => item.propId === newItem.propId);
                if (existingItem) {
                    existingItem.num = newItem.num;
                } else {
                    this.bagData.push(newItem);
                }
            });
            logger.debug("[背包管理] 更新背包数据");

            // 背包数据更新后，如果桃子/灵草有货了，恢复对应任务
            this.resumeChopIfNeeded();
        }
        if (!this.initialized) {
            logger.info(`[背包管理] 当前有仙桃: ${this.getGoodsNum(100004)} 仙玉: ${this.getGoodsNum(100000)}`);
            this.initialized = true;
        }
    }

    resumeChopIfNeeded() {
        // 桃子有货且砍树开关开启且之前被停止了，恢复砍树任务
        const peaches = this.getGoodsNum(100004);
        const stopNum = global.account.chopTree?.stop?.num ?? 50;
        if (peaches > stopNum && !PlayerAttributeMgr.inst.chopEnabled && global.account.switch.chopTree) {
            PlayerAttributeMgr.inst.chopEnabled = true;
            PlayerAttributeMgr.inst.initPeachNum = -1;
            WorkFlowMgr.inst.add("ChopTree");
            logger.info(`[背包管理] 桃子恢复到 ${peaches}，重新启用砍树`);
        }

        // 灵草有货且灵脉开关开启，恢复灵脉任务
        const flowers = this.getGoodsNum(100007);
        const flowerStopNum = global.account.talent?.stop?.stopNum ?? 300;
        if (flowers > flowerStopNum && !PlayerAttributeMgr.inst.talentEnabled && global.account.switch.talent) {
            PlayerAttributeMgr.inst.talentEnabled = true;
            PlayerAttributeMgr.inst.initFlowerNum = -1;
            WorkFlowMgr.inst.add("Talent");
            logger.info(`[背包管理] 灵草恢复到 ${flowers}，重新启用灵脉`);
        }
    }

    setMallCount(mallId, count) {
        const mallItem = this.mallBuyCountList.find((item) => item.mallId === mallId);
        if (mallItem) {
            mallItem.count = count;
        } else {
            this.mallBuyCountList.push({ mallId, count });
        }
    }

    isMallCountZero(mallId) {
        const mallItem = this.mallBuyCountList.find((item) => item.mallId === mallId);
        return mallItem ? mallItem.count === 0 : false;
    }

    checkBuyGoods(t) {
        this.mallBuyCountList = t.mallBuyCountList || [];
        if (this.isMallCountZero(250000001)) {
            logger.info("[自动买买买] 群英镑商店 买桃");
            GameNetMgr.inst.sendPbMsg(Protocol.S_MALL_BUY_GOODS, { mallId: 250000001, count: 1, activityId: 0 });
            this.setMallCount(250000001, 1); // 更新购买数量
        }
    }

    getGoodsNum(id) {
        const item = this.bagData.find((item) => item.propId === id);
        return item ? item.num : 0;
    }

    getTicketThreshold() {
        return this.ticket;
    }

    // 斗法：从对手列表中找妖力低于自身的对手
    handleRankBattleList(t) {
        if (this.rankBattleState !== "waiting") return;

        const opponents = t.playerBattleShowDataMsg || [];
        if (opponents.length === 0) {
            logger.warn("[斗法] 对手列表为空");
            this.rankBattleState = "idle";
            return;
        }

        const myFightValue = Number(PlayerAttributeMgr.fightValue);
        let targetIndex = -1;

        for (let i = 0; i < opponents.length; i++) {
            const oppFightValue = Number(opponents[i].playerBaseDataMsg?.fightValue || 0);
            if (oppFightValue > 0 && oppFightValue < myFightValue) {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex === -1) {
            // 没找到妖力更低的，取妖力最低的
            let minFight = Infinity;
            for (let i = 0; i < opponents.length; i++) {
                const oppFightValue = Number(opponents[i].playerBaseDataMsg?.fightValue || 0);
                if (oppFightValue > 0 && oppFightValue < minFight) {
                    minFight = oppFightValue;
                    targetIndex = i;
                }
            }
            if (targetIndex === -1) targetIndex = 0;
            logger.info(`[斗法] 无妖力更低的对手，选最低妖力 ${minFight}，index=${targetIndex}`);
        } else {
            logger.info(`[斗法] 找到妖力更低的对手 index=${targetIndex}，妖力=${opponents[targetIndex].playerBaseDataMsg?.fightValue}`);
        }

        this.rankBattleState = "challenging";
        GameNetMgr.inst.sendPbMsg(Protocol.S_RANK_BATTLE_CHALLENGE, { index: targetIndex });
    }

    // 斗法：处理挑战结果，循环直到券耗尽
    handleRankBattleResult(t) {
        if (this.rankBattleState !== "challenging") return;

        const success = t.rankBattleResultMsg?.challengeSuccess;
        logger.info(`[斗法] ${success ? "胜利" : "失败"}`);

        // 继续斗法直到券不够
        const fightTicket = this.getGoodsNum(100026);
        if (fightTicket > this.getTicketThreshold()) {
            logger.info(`[斗法] 还剩 ${fightTicket} 张斗法券，继续挑战`);
            this.rankBattleState = "waiting";
            GameNetMgr.inst.sendPbMsg(Protocol.S_RANK_BATTLE_GET_BATTLE_LIST, {});
        } else {
            logger.info(`[斗法] 斗法券剩余 ${fightTicket}，停止斗法`);
            this.rankBattleState = "idle";
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 斗法：状态机驱动，接收服务器响应后才继续，循环直到券耗尽
            if (this.rankBattleState === "idle") {
                const fightTicket = this.getGoodsNum(100026);
                if (fightTicket > this.getTicketThreshold()) {
                    logger.info(`[背包管理] 还剩 ${fightTicket} 张斗法券 自动斗法`);
                    this.rankBattleState = "waiting";
                    GameNetMgr.inst.sendPbMsg(Protocol.S_RANK_BATTLE_GET_BATTLE_LIST, {});
                }
            }

            // 万年灵芝 > 0 的时候自动激活
            const books = this.getGoodsNum(100008);
            if (books > 0) {
                logger.info(`[背包管理] 还剩 ${books} 万年灵芝`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_TALENT_READ_BOOK, { readTimes: books.toString() });
            }

            // 净瓶水 > 0 时自动加速仙树升级
            const water = this.getGoodsNum(100025);
            const upgradeEndTime = PlayerAttributeMgr.inst.dreamLvUpEndTime || 0;
            if (water > 0 && upgradeEndTime > Date.now()) {
                logger.info(`[仙树] 净瓶水 ${water}，加速仙树升级`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_DREAM_LV_UP_SPEED_UP, { speedUpType: 2, useTimes: 1, isUseADTime: false });
            }

            // 仙树不在升级状态时，自动尝试升级（每30秒检查一次）
            if (upgradeEndTime <= Date.now() && Date.now() - this.lastTreeLvUpTime >= 30000) {
                const treeLevel = PlayerAttributeMgr.inst.treeLevel || 1;
                logger.info(`[仙树] 当前等级 ${treeLevel}，尝试自动升级`);
                this.lastTreeLvUpTime = Date.now();
                GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_DREAM_LV_UP, {});
            }
        } catch (error) {
            logger.error(`[背包管理] 循环任务失败 ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
