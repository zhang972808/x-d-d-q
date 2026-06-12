import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import DBMgr from "#game/common/DBMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import PetKernelMgr from "#game/mgr/PetKernelMgr.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";

/**
 * 灵兽：灵兽自动刷新和捕捉
 */
export default class PetMgr {

    constructor() {
        this.MAX_FREE_REFRESH_NUM = 4; // 免费刷新次数
        this.AD_REWARD_CD = 10 * 1000; // 刷新cd，默认10秒

        this.freeRefreshTimes = 0; //已经免费刷新的次数
        this.petPoolData = []; //用于存放刷新出来的灵兽池子, [{isGet=false, petId=11401},{isGet=false, petId=11401},{isGet=false, petId=11401}]

        // 灵兽刷新愿望池子(默认为:应龙，鸾鸟和五大神话)
        this.wishPets = global.account.wishPetPool || [114001, 114007, 115001, 115002, 115003, 115004, 115005];
        this.lastAdRewardTime = 0;

        this.isProcessing = false;
        this.initialized = false;
        this.refreshLock = false;
        this.catchLock = false; // 防止重复抓捕
        this.catchCooldown = 0; // 抓捕冷却时间
    }

    static get inst() {
        if (!SystemUnlockMgr.PET) {
            logger.warn("[灵兽管理] 灵兽系统未解锁");
            return null;
        }

        if (!this._instance) {
            this._instance = new PetMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 同步玩家灵兽数据
    SyncPlayerPetDataMsg(t) {
        this.isProcessing = true;
        
        // 同步内丹数据
        if (t.kernelData) {
            PetKernelMgr.inst.syncPetKernelMsg(t.kernelData);
        }

        // 灵兽池子
        this.petPoolData = t.petPoolData;
        // 免费灵兽刷新次数
        this.freeRefreshTimes = t.freeRefreshTimes;
        
        this.initialized = true;

        this.isProcessing = false;
    }

    // 刷新灵兽返回结果
    RefreshPetPoolResp(t) {
        if (t.ret === 0) {
            this.petPoolData = t.petPoolData;
            const names = this.petPoolData.map(item => {
                const name = DBMgr.inst.getLanguageWord(`Items-${item.petId}`) || `ID${item.petId}`;
                return (item.isGet ? '✅已抓' : '⬜可抓') + ' ' + name;
            });
            logger.info(`[灵兽管理] 本次灵兽刷新结果: ${names.join(', ')}`);
            this.refreshLock = false;
        }
    }

    // 抓捕灵兽返回结果
    CatchPetResp(t) {
        this.catchLock = false;
        if (t.ret === 0) {
            const petName = t.petData
                ? DBMgr.inst.getLanguageWord(`Items-${t.petData.configId}`) || `灵兽ID${t.petData.configId}`
                : '未知灵兽';
            logger.warn(`[灵兽管理] 🎉 抓捕成功！获得 ${petName} (星级:${t.petData?.star || 0} 等级:${t.petData?.lv || 1})`);
            // 更新池子状态，标记已抓捕
            this.catchCooldown = Date.now() + 3000;
        } else {
            logger.error(`[灵兽管理] 抓捕失败 ret=${t.ret}`);
        }
    }

    // 发送抓捕请求
    catchPet(poolIndex, petId) {
        if (this.catchLock) return;
        const petName = DBMgr.inst.getLanguageWord(`Items-${petId}`) || `灵兽ID${petId}`;
        logger.warn(`[灵兽管理] 🔨 尝试抓捕: ${petName} (poolIndex: ${poolIndex})`);
        this.catchLock = true;
        GameNetMgr.inst.sendPbMsg(Protocol.S_PET_CATCH, { poolIndex }, null);
    }

    processReward() {
        if (this.refreshLock) {
            logger.debug(`[灵兽管理] 灵兽刷新结果未返回,暂不推送执行任务`);
            return;
        }

        const now = Date.now();
        if (this.freeRefreshTimes < this.MAX_FREE_REFRESH_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD) {
            this.refreshLock = true;

            const logContent = `[灵兽刷新] 还剩 ${this.MAX_FREE_REFRESH_NUM - this.freeRefreshTimes - 1} 次免费刷新`;
            AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_PET_REFRESH_POOL, data: { isUseADTime: false, isFree: 1 }, logStr: logContent });
            this.lastAdRewardTime = now;
            this.freeRefreshTimes++;
        }
    }

    // 定时执行方法
    async loopUpdate() {
        if (this.isProcessing || !this.initialized) return;
        this.isProcessing = true;

        try {
            if (this.freeRefreshTimes >= this.MAX_FREE_REFRESH_NUM) {
                this.clear();
                logger.info("[灵兽管理] 灵兽刷新达到每日最大领取次数，停止刷新");
                return;
            }

            if (this.petPoolData.length == 0 || this.refreshLock) {
                return;
            }

            if (this.wishPets.length == 0) {
                logger.info(`[灵兽刷新] 无期望灵兽,不执行免费刷新`);
                this.clear();
                return;
            }

            // 抓捕冷却中，跳过
            if (this.catchLock || (this.catchCooldown && Date.now() < this.catchCooldown)) {
                return;
            }

            // 检查是否有期望灵兽可以抓捕
            for (let i = 0; i < this.petPoolData.length; i++) {
                const item = this.petPoolData[i];
                if (this.wishPets.includes(item.petId) && !item.isGet) {
                    this.catchPet(i, item.petId);
                    return; // 一次只抓一只
                }
            }

            // 没有期望灵兽（或都已抓完），继续刷新
            this.processReward();
        } catch (error) {
            logger.error(`[灵兽管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}