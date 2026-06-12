import { setWebSocket } from "#utils/logger.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import BagMgr from "#game/mgr/BagMgr.js";
import DBMgr from "#game/common/DBMgr.js";

let intervalId = null;
let currentWs = null;

export function updateWs(ws) {
    currentWs = ws;
}

export function startStatusReport() {
    if (intervalId) return;
    intervalId = setInterval(() => {
        try {
            const realms = DBMgr.inst.getRealms(PlayerAttributeMgr.level);
            const realmName = realms ? DBMgr.inst.getLanguageWord(realms.name) : "未知";

            const sepIdx = PlayerAttributeMgr.inst.useSeparationIdx;
            const upgradeEndTime = PlayerAttributeMgr.inst.dreamLvUpEndTime || 0;
            const now = Date.now();
            const status = {
                type: "status",
                data: {
                    level: PlayerAttributeMgr.level,
                    realm: realmName,
                    exp: PlayerAttributeMgr.currentExp || "0",
                    maxExp: realms?.demonicMax || "0",
                    jade: BagMgr.inst.getGoodsNum(100000),
                    peaches: BagMgr.inst.getGoodsNum(100004),
                    water: BagMgr.inst.getGoodsNum(100025),
                    herb: BagMgr.inst.getGoodsNum(100007),
                    separation: sepIdx !== null ? PlayerAttributeMgr.inst.separationNames[sepIdx] : "未知",
                    fightValue: PlayerAttributeMgr.fightValue || 0,
                    treeLevel: PlayerAttributeMgr.inst.treeLevel || 1,
                    treeUpgrading: upgradeEndTime > now,
                    treeRemaining: upgradeEndTime > now ? Math.max(0, ((upgradeEndTime - now) / 3600000).toFixed(1)) : 0,
                },
            };

            if (currentWs && currentWs.readyState === 1) {
                currentWs.send(JSON.stringify(status));
            }
        } catch (e) {
            // silently ignore status report errors
        }
    }, 2000);
}

export function stopStatusReport() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}
