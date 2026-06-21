import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";

/**
 * 群英榜 — 每日打榜，无时间限制
 * 获取对手列表 → 打第一个 → 赢了刷新列表再打第一个，输了打第二个 → 体力打完停止
 */
export default class HeroRankMgr {
    constructor() {
        this.isProcessing = false;
        this.buyNumDaily = 0;
        this.energy = 0;
        this.rank = null;
        this.opponentIndex = 0;   // 当前打列表第几个（0=第一个）
    }

    static get inst() {
        if (!SystemUnlockMgr.HERORANK) {
            logger.warn(`[群英榜管理] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }
        if (!this._instance) {
            this._instance = new HeroRankMgr();
        }
        return this._instance;
    }

    reset() { this._instance = null; }
    clear() { LoopMgr.inst.remove(this); }

    getBuyNumMax() {
        const dayIndex = new Date().getDay();
        const cfg = global.account?.switch?.herorankBuyNumMax;
        const num = Array.isArray(cfg) ? (cfg[dayIndex] ?? 0) : 0;
        return Math.max(Math.min(parseInt(num), 10), 0);
    }

    SyncData(t) {
        try {
            logger.debug("[群英榜管理] 初始化");
            this.energy = t.energy || 0;
            this.buyNumDaily = t.buyNumDaily || 0;

            const buyNumMax = this.getBuyNumMax();
            if ((global.account.switch?.herorank ?? false) && this.buyNumDaily < buyNumMax && this.energy <= 50) {
                const num = buyNumMax - this.buyNumDaily;
                logger.info(`[群英榜管理] 购买体力 ${num}次`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_BUY_ENERGY, { num });
            }
        } catch (error) {
            logger.error(`[群英榜管理] SyncData error: ${error}`);
        }
    }

    // 获取对手列表中第 index 个可挑战的
    getPlayerByIndex(body, index) {
        try {
            const list = body.fightPlayerList?.canFightPlayerInfoList;
            if (!list || list.length <= index) return null;
            return list[index];
        } catch (e) {
            return null;
        }
    }

    // 收到对手列表 → 按 opponentIndex 选对手打
    getFightList(t) {
        this.isProcessing = true;
        try {
            if (t.ret !== 0) return;
            this.rank = t.rank || null;

            const player = this.getPlayerByIndex(t, this.opponentIndex);
            if (!player) {
                logger.info("[群英榜管理] 对手列表已打完，停止");
                this.clear();
                return;
            }

            logger.info(`[群英榜管理] 打第${this.opponentIndex + 1}个: ${player.showInfo.nickName}`);
            const fight = {
                targetId: player.showInfo.playerId,
                targetRank: player.rank,
                masterId: 0,
                masterLv: 0,
                appearanceId: 0,
                cloudId: 0,
            };
            if (player.masterId) {
                fight.masterId = player.masterId;
                fight.masterLv = player.masterLv;
                fight.appearanceId = player.showInfo.appearanceId;
                fight.cloudId = player.showInfo.equipCloudId;
            }
            GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_FIGHT, fight);
            this.energy--;
        } catch (error) {
            logger.error(`[群英榜管理] getFightList error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }

    // 收到战斗结果
    async doFight(t) {
        this.isProcessing = true;
        try {
            if (t.ret !== 0) return;
            this.energy = t.playerInfo?.energy ?? this.energy;

            if (t.allBattleRecord?.isWin) {
                logger.info(`[群英榜] 胜利 排名:${t.rank}, 剩余体力:${this.energy}`);
                // 赢了 → 从第0个重新打
                this.opponentIndex = 0;
            } else {
                logger.info(`[群英榜] 失败 剩余体力:${this.energy}`);
                // 输了 → 打下一个
                this.opponentIndex++;
            }
        } catch (error) {
            logger.error(`[群英榜] doFight error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        if (!(global.account.switch?.herorank ?? false)) return;
        if (this.energy < 1) {
            logger.info("[群英榜管理] 体力不足，停止");
            this.clear();
            return;
        }

        this.isProcessing = true;
        try {
            logger.info(`[群英榜管理] 请求对手列表 (体力:${this.energy})`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_GET_FIGHT_LIST, { type: 0 });
        } catch (error) {
            logger.error(`[群英榜管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
