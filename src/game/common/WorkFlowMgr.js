// 强制顺序执行(简单版)
import logger from "#utils/logger.js";

export default class WorkFlowMgr {
    constructor() {
        this.queue = [];
        this.sortedQueue = []; // 缓存排序后的队列

        this.priorityDict = {
            "Challenge": 0,      // 最高优先级 - 每天6-8点推图/镇妖塔/真火
            "Invade": 3,         // 3级项目 异兽入侵
            "SkyWar": 5,         // 5级项目 征战诸天
        };
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new WorkFlowMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        this.queue = [];
        this.sortedQueue = []; // 同时清空已排序的队列
    }

    // 排序并缓存队列
    sortQueue() {
        this.sortedQueue = [...this.queue].sort((a, b) => {
            const priorityA = this.priorityDict[a] ?? Number.MAX_SAFE_INTEGER;
            const priorityB = this.priorityDict[b] ?? Number.MAX_SAFE_INTEGER;
            return priorityA - priorityB;
        });
        logger.info(`[顺序管理] 排序后的任务队列: ${this.sortedQueue}`);
    }

    start() {
        // 添加3级项目
        const Invade = global.account.switch.invade || false;
        if (Invade) {
            logger.info("[顺序管理] 已开启自动异兽入侵");
            this.add("Invade");
        }
        // 添加4级项目：征战诸天
        const SkyWar = global.account.switch.skywar ?? false;
        if (SkyWar) {
            logger.info("[顺序管理] 已开启自动征战诸天");
            this.add("SkyWar");
        }
        // 0级项目（挑战）：只在天时间窗口内添加
        // 不在 start() 加了，由 checkSchedule() 统一管理
    }

    // 获取当前北京时间的小时
    getBeijingHour() {
        const now = new Date();
        return (now.getUTCHours() + 8) % 24;
    }

    // 获取今天日期（北京时间）
    getBeijingDay() {
        const now = new Date();
        return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    }

    // 检查时间窗口：从配置读取起止小时（默认 6:00 ~ 8:00）
    isInChallengeWindow() {
        const hour = this.getBeijingHour();
        const start = global.account.switch.challengeWindowStart ?? 6;
        const end = global.account.switch.challengeWindowEnd ?? 8;
        return hour >= start && hour < end;
    }

    // 定时调度：每秒检查一次
    checkSchedule() {
        const challengeCfg = global.account.switch.challenge || 0;
        if (challengeCfg <= 0) return;

        const today = this.getBeijingDay();

        // 每天首次进入窗口时，重置每日挑战次数
        if (this._lastChallengeDay !== today) {
            this._lastChallengeDay = today;
            logger.info("[顺序管理] 📅 新的一天，挑战次数已重置");
        }

        if (this.isInChallengeWindow()) {
            if (!this.queue.includes("Challenge")) {
                const start = global.account.switch.challengeWindowStart ?? 6;
                const end = global.account.switch.challengeWindowEnd ?? 8;
                logger.info(`[顺序管理] ⏰ 进入${start}-${end}点挑战窗口，开启自动挑战`);
                this.add("Challenge");
            }
        } else {
            if (this.queue.includes("Challenge")) {
                const start = global.account.switch.challengeWindowStart ?? 6;
                const end = global.account.switch.challengeWindowEnd ?? 8;
                logger.info(`[顺序管理] ⏰ 超出${start}-${end}点挑战窗口，暂停自动挑战`);
                this.remove("Challenge");
            }
        }
    }

    canExecute(t) {
        // 检查排序后的队列是否为空，并判断是否为首位任务
        return this.sortedQueue.length > 0 && this.sortedQueue[0] === t;
    }

    add(name) {
        if (!this.queue.includes(name)) {
            this.queue.push(name);
            this.sortQueue();
        }
    }

    remove(name) {
        if (this.queue.includes(name)) {
            this.queue = this.queue.filter(task => task !== name);
            this.sortQueue();
        }
    }
}

// // O(n)
// class PriorityQueue {
//     constructor() {
//         this.queue = [];
//     }

//     enqueue(task, priority) {
//         this.queue.push({ task, priority });
//         this.bubbleUp();
//     }

//     dequeue() {
//         if (this.queue.length === 0) return null;
//         this.swap(0, this.queue.length - 1);
//         const task = this.queue.pop();
//         this.bubbleDown();
//         return task.task;
//     }

//     bubbleUp() {
//         let index = this.queue.length - 1;
//         while (index > 0) {
//             const parentIndex = Math.floor((index - 1) / 2);
//             if (this.queue[index].priority >= this.queue[parentIndex].priority) break;
//             this.swap(index, parentIndex);
//             index = parentIndex;
//         }
//     }

//     bubbleDown() {
//         let index = 0;
//         const length = this.queue.length;
//         while (true) {
//             let left = 2 * index + 1;
//             let right = 2 * index + 2;
//             let swapIndex = null;

//             if (left < length && this.queue[left].priority < this.queue[index].priority) {
//                 swapIndex = left;
//             }

//             if (right < length && this.queue[right].priority < (swapIndex === null ? this.queue[index].priority : this.queue[left].priority)) {
//                 swapIndex = right;
//             }

//             if (swapIndex === null) break;
//             this.swap(index, swapIndex);
//             index = swapIndex;
//         }
//     }

//     swap(i, j) {
//         [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
//     }

//     peek() {
//         return this.queue.length === 0 ? null : this.queue[0].task;
//     }

//     isEmpty() {
//         return this.queue.length === 0;
//     }
// }

// export default class WorkFlowMgr {
//     constructor() {
//         this.priorityDict = {
//             "ChopTree": 0,
//             "Talent": 1,
//             "Invade": 2,
//             "Challenge": 3
//         };

//         this.queue = new PriorityQueue();
//     }

//     add(task) {
//         if (!this.queue.peek(task)) {
//             const priority = this.priorityDict[task] ?? Number.MAX_SAFE_INTEGER;
//             this.queue.enqueue(task, priority);
//         }
//     }

//     canExecute(task) {
//         return this.queue.peek() === task;
//     }

//     remove(task) {
//         if (this.queue.peek() === task) {
//             this.queue.dequeue();
//         }
//     }

//     clear() {
//         this.queue = new PriorityQueue();
//     }
// }
