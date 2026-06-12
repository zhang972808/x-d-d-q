import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '#utils/logger.js';
import { updateAccountStatus } from '#server/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// 进程注册表: accountId -> { process, pid, port, status, logs, wsClients }
const processes = new Map();

// 每个进程保留最近 2000 条日志
const MAX_LOG_LINES = 2000;

// 端口池: 从 8082 开始分配
let nextPort = 8082;
const usedPorts = new Set();
const BASE_PORT = parseInt(process.env.BASE_PORT || '8082', 10);
nextPort = BASE_PORT;

function allocatePort() {
  while (usedPorts.has(nextPort)) {
    nextPort++;
  }
  const port = nextPort;
  usedPorts.add(port);
  nextPort++;
  return port;
}

function releasePort(port) {
  usedPorts.delete(port);
}

/**
 * 为指定的游戏账号创建配置文件并启动 app.js
 */
export async function startGameAccount(account) {
  const { id, nickname, server_id, game_username, game_password, token, uid, config, platform } = account;

  // 检查是否已在运行
  if (processes.has(id)) {
    const existing = processes.get(id);
    // 杀掉旧进程再重启
    if (existing.process && !existing.process.killed) {
      logger.info(`[ProcessManager] 账号 "${nickname || id}" 已在运行，先停止旧进程 (PID: ${existing.pid})`);
      existing.process.kill("SIGTERM");
    }
    processes.delete(id);
  }

  // 分配端口
  const port = allocatePort();

  // 解析配置
  let configObj;
  try {
    configObj = typeof config === 'string' ? JSON.parse(config) : (config || {});
  } catch (e) {
    configObj = {};
  }

  // 构建配置文件
  const safeNickname = (nickname || `account_${id}`).replace(/[<>:"/\\|?*]/g, '_');
  const configFileName = `${id}_${safeNickname}.json`;
  const configPath = path.join(PROJECT_ROOT, 'data', configFileName);

  // 确保 data 目录存在
  const dataDir = path.join(PROJECT_ROOT, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const fileConfig = {
    nickName: nickname || '',
    loginToken: process.env.LOGIN_TOKEN || '777',
    maxRetries: 'infinity',
    reconnectInterval: 300000,
    startupDelay: 5000,
    serverId: server_id || '',
    username: game_username || '',
    password: game_password || '',
    uid: uid || '',
    token: token || '',
    ...configObj,
  };

  fs.writeFileSync(configPath, JSON.stringify(fileConfig, null, 4), 'utf8');
  logger.info(`[ProcessManager] 配置文件已写入: ${configPath}`);

  // 启动子进程
  const appJsPath = path.join(PROJECT_ROOT, 'app.js');
  const env = { ...process.env, PORT: String(port) };

  const child = spawn('node', [appJsPath, configPath, String(port)], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const logs = [];

  // 收集日志
  const addLog = (line, level = 'info') => {
    const entry = {
      time: new Date().toISOString(),
      level,
      message: line.trim(),
    };
    logs.push(entry);
    if (logs.length > MAX_LOG_LINES) {
      logs.splice(0, logs.length - MAX_LOG_LINES);
    }
  };

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => addLog(line, 'info'));
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => addLog(line, 'error'));
  });

  child.on('error', (err) => {
    addLog(`进程错误: ${err.message}`, 'error');
    updateAccountStatus(id, 'stopped', null, port);
    releasePort(port);
    processes.delete(id);
  });

  child.on('exit', (code, signal) => {
    addLog(`进程退出 (code=${code}, signal=${signal})`, code === 0 ? 'info' : 'warn');
    updateAccountStatus(id, 'stopped', null, null);
    releasePort(port);
    processes.delete(id);
  });

  processes.set(id, {
    process: child,
    pid: child.pid,
    port,
    status: 'running',
    logs,
    accountId: id,
  });

  // 更新数据库状态
  updateAccountStatus(id, 'running', child.pid, port);

  logger.info(`[ProcessManager] 已启动游戏账号 "${nickname || id}" (PID: ${child.pid}, Port: ${port})`);

  return { pid: child.pid, port, status: 'running' };
}

/**
 * 停止指定的游戏账号进程
 */
export async function stopGameAccount(accountId) {
  const procInfo = processes.get(accountId);
  if (!procInfo || !procInfo.process) {
    // 可能在数据库中标记为运行但进程已死
    updateAccountStatus(accountId, 'stopped', null, null);
    throw new Error(`账号 ${accountId} 未在运行`);
  }

  if (procInfo.process.killed) {
    processes.delete(accountId);
    updateAccountStatus(accountId, 'stopped', null, null);
    throw new Error(`账号 ${accountId} 进程已退出`);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      // 5秒后强制kill
      try { procInfo.process.kill('SIGKILL'); } catch (e) { /* ignore */ }
    }, 5000);

    procInfo.process.on('exit', () => {
      clearTimeout(timeout);
      if (procInfo.port) releasePort(procInfo.port);
      processes.delete(accountId);
      updateAccountStatus(accountId, 'stopped', null, null);
      resolve({ success: true, message: `账号 ${accountId} 已停止` });
    });

    try {
      procInfo.process.kill('SIGTERM');
    } catch (e) {
      clearTimeout(timeout);
      if (procInfo.port) releasePort(procInfo.port);
      processes.delete(accountId);
      updateAccountStatus(accountId, 'stopped', null, null);
      reject(new Error(`无法停止进程: ${e.message}`));
    }
  });
}

/**
 * 获取游戏账号运行状态
 */
export function getGameStatus(accountId) {
  const procInfo = processes.get(accountId);
  if (!procInfo) {
    return { status: 'stopped', pid: null, port: null };
  }
  return {
    status: procInfo.process.killed ? 'stopped' : 'running',
    pid: procInfo.pid,
    port: procInfo.port,
  };
}

/**
 * 获取进程日志
 */
export function getGameLogs(accountId, since = null) {
  const procInfo = processes.get(accountId);
  if (!procInfo) return [];
  const { logs } = procInfo;
  if (!since) return logs.slice(-500);
  return logs.filter(l => l.time > since);
}

/**
 * 获取所有运行中的进程信息
 */
export function getAllProcesses() {
  const result = [];
  for (const [id, info] of processes) {
    result.push({
      accountId: id,
      pid: info.pid,
      port: info.port,
      status: info.process.killed ? 'stopped' : 'running',
    });
  }
  return result;
}

export default {
  startGameAccount,
  stopGameAccount,
  getGameStatus,
  getGameLogs,
  getAllProcesses,
};
