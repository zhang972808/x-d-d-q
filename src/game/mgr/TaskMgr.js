import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import DBMgr from "#game/common/DBMgr.js";

export default class TaskMgr {
  constructor() {
    this.taskMap = {};
    this.isProcessing = false;
    this.lastClaimTime = 0;
  }

  static get inst() {
    if (!this._instance) {
      this._instance = new TaskMgr();
    }
    return this._instance;
  }

  reset() {
    this._instance = null;
  }

  clear() {
    LoopMgr.inst.remove(this);
  }

  // 全量同步（登录时）
  initTaskList(msgData) {
    const dataList = msgData.dataList || [];
    this.taskMap = {};
    dataList.forEach((task) => {
      this.taskMap[task.taskId] = task;
    });
    logger.debug(`[任务管理] 全量同步 ${dataList.length} 个任务`);
    this.autoClaimRewards();
  }

  // 增量同步（任务进度更新）
  syncTaskList(msgData) {
    const dataList = msgData.dataList || [];
    dataList.forEach((task) => {
      this.taskMap[task.taskId] = task;
    });
    logger.debug(`[任务管理] 增量同步 ${dataList.length} 个任务`);
    this.autoClaimRewards();
  }

  // 领取奖励返回
  onGetRewardResp(msgData) {
    if (msgData.rewards) {
      const rewardsArray = msgData.rewards.split("|");
      rewardsArray.forEach((reward) => {
        const [key, value] = reward.split("=");
        const rewardName = DBMgr.inst.getLanguageWord(`Items-${key}`);
        logger.info(`[任务管理] 获得: ${rewardName} 数量: ${value}`);
      });
    }
  }

  // 自动领取已完成任务奖励
  autoClaimRewards() {
    const completedTasks = Object.values(this.taskMap).filter(
      (task) => task.state === 1
    );

    if (completedTasks.length === 0) return;

    const taskIds = completedTasks.map((t) => t.taskId);
    logger.info(`[任务管理] 自动领取 ${taskIds.length} 个任务奖励: [${taskIds.join(", ")}]`);
    GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: taskIds });
    this.lastClaimTime = Date.now();
  }

  async loopUpdate() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 每 30 秒检查一次是否有遗漏的已完成任务
      const now = Date.now();
      if (now - this.lastClaimTime > 30000) {
        this.autoClaimRewards();
      }
    } catch (error) {
      logger.error(`[任务管理] 异常: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
