import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import logger from '#utils/logger.js';
import { authMiddleware } from '#server/middleware.js';
import { getActiveNotices, getRunningAccounts, initDatabase } from '#server/database.js';
import { getAllProcesses, getGameLogs, getGameStatus, startGameAccount, stopGameAccount } from '#server/processManager.js';

// 路由
import authRoutes from '#server/authRoutes.js';
import userRoutes from '#server/userRoutes.js';
import gameAccountRoutes from '#server/gameAccountRoutes.js';
import adminRoutes from '#server/adminRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.MGMT_PORT || 8080;

const app = express();
const server = http.createServer(app);

// ==================== 中间件 ====================
app.use(cors());
app.use(express.json());

// ==================== 静态文件 ====================
app.use(express.static(path.resolve(__dirname, '../../public')));

// ==================== 公开 API ====================

// POST /api/auth/*
app.use('/api/auth', authRoutes);

// GET /api/maintenance/status
app.get('/api/maintenance/status', (req, res) => {
  res.json({ code: 200, msg: '', data: { maintenance: false } });
});

// GET /api/common/notice/:id
app.get('/api/common/notice/:id', (req, res) => {
  const notices = getActiveNotices();
  const notice = notices.find(n => n.id === Number(req.params.id));
  if (!notice) {
    return res.json({ code: 404, msg: '公告不存在', data: null });
  }
  res.json({ code: 200, msg: '', data: notice });
});

// ==================== 需要认证的 API ====================

// 用户相关
app.use('/api/user', authMiddleware, userRoutes);

// 游戏账号管理
app.use('/api/sub-user', authMiddleware, gameAccountRoutes);

// 容器控制（进程管理）
import { getAccountById, updateAccountToken, addAuditLog } from '#server/database.js';
import AuthService from '#services/authService.js';

app.post('/api/kubernetes/run', authMiddleware, async (req, res) => {
  try {
    const { account_id } = req.body;
    const accountId = Number(account_id);
    const account = getAccountById(accountId);
    if (!account) return res.json({ code: 404, msg: '账号不存在', data: null });
    if (account.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.json({ code: 403, msg: '无权操作', data: null });
    }
    if (!account.game_username || !account.game_password) {
      return res.json({ code: 400, msg: '请先填写游戏账号和密码', data: null });
    }
    if (!account.server_id) {
      return res.json({ code: 400, msg: '请先获取服务器并选择服务器', data: null });
    }
    const result = await startGameAccount(account);
    addAuditLog(req.user.userId, 'start_account', `启动: ${account.nickname}`, accountId);
    res.json({ code: 200, msg: '启动成功', data: result });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

app.post('/api/kubernetes/stop', authMiddleware, async (req, res) => {
  try {
    const { account_id } = req.body;
    const accountId = Number(account_id);
    await stopGameAccount(accountId);
    addAuditLog(req.user.userId, 'stop_account', `停止账号`, accountId);
    res.json({ code: 200, msg: '已停止', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

app.get('/api/kubernetes/queue-position', authMiddleware, (req, res) => {
  res.json({ code: 200, msg: '', data: { position: 0 } });
});

app.get('/api/kubernetes/log-stream-poll', authMiddleware, (req, res) => {
  try {
    const { account_id, since } = req.query;
    const accountId = Number(account_id);
    if (!accountId) return res.json({ code: 400, msg: '缺少 account_id', data: null });
    const logs = getGameLogs(accountId, since);
    res.json({ code: 200, msg: '', data: { logs, lastLine: logs.length } });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

app.post('/api/common/status', authMiddleware, (req, res) => {
  try {
    const { account_ids } = req.body;
    const ids = account_ids || [];
    const result = {};
    for (const id of ids) {
      result[id] = getGameStatus(Number(id));
    }
    res.json({ code: 200, msg: '', data: result });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// 渠道服务器列表
app.get('/api/chan/qq/servers', authMiddleware, async (req, res) => {
  try {
    const { username, password } = req.query;
    if (!username || !password) {
      return res.json({ code: 400, msg: '需要提供游戏账号和密码', data: null });
    }
    const auth = new AuthService();
    const result = await auth.List(username, password);
    res.json({
      code: 200, msg: '',
      data: {
        server_list: {
          servers: (result.servers || []).map(s => ({
            serverId: s.serverId,
            serverName: s.serverName,
          })),
        },
      },
    });
  } catch (err) {
    logger.error(`获取服务器列表失败: ${err.message}`);
    res.json({ code: 500, msg: err.message, data: null });
  }
});

app.get('/api/chan/app/servers', authMiddleware, async (req, res) => {
  try {
    const { username, password } = req.query;
    if (!username || !password) {
      return res.json({ code: 400, msg: '需要提供游戏账号和密码', data: null });
    }
    const auth = new AuthService();
    const result = await auth.List(username, password);
    res.json({
      code: 200, msg: '',
      data: {
        server_list: {
          servers: (result.servers || []).map(s => ({
            serverId: s.serverId,
            serverName: s.serverName,
          })),
        },
      },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// 游戏账号登录（获取游戏token）
app.post('/api/sub-user/:id/login', authMiddleware, async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    const account = getAccountById(accountId);
    if (!account) return res.json({ code: 404, msg: '账号不存在', data: null });
    if (account.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.json({ code: 403, msg: '无权操作', data: null });
    }
    const auth = new AuthService();
    const loginResult = await auth.Login(account.game_username, account.game_password, account.server_id);
    updateAccountToken(accountId, loginResult.token, loginResult.playerId, loginResult.nickName || account.nickname);
    addAuditLog(req.user.userId, 'game_login', `游戏登录成功: ${account.nickname}`, accountId);
    res.json({
      code: 200, msg: '游戏登录成功',
      data: {
        token: loginResult.token,
        playerId: loginResult.playerId,
        wsAddress: loginResult.wsAddress,
        nickName: loginResult.nickName,
      },
    });
  } catch (err) {
    res.json({ code: 500, msg: `登录失败: ${err.message}`, data: null });
  }
});

// 管理后台（内部有 adminMiddleware 检查）
app.use('/api/admin', authMiddleware, adminRoutes);

// ==================== 前端 SPA 回退 ====================
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../public/index.html'));
});

// ==================== WebSocket ====================
const wss = new WebSocketServer({ server });

// 存储连接的客户端及其订阅
const wsClients = new Map(); // ws -> { userId, subscribedAccounts: Set }

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const accountId = url.searchParams.get('accountId');

  wsClients.set(ws, {
    userId: token || 'anonymous',
    subscribedAccounts: new Set(accountId ? [Number(accountId)] : []),
  });

  logger.debug(`[WebSocket] 新客户端连接 (accountId: ${accountId})`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'subscribe' && msg.accountId) {
        const client = wsClients.get(ws);
        if (client) {
          client.subscribedAccounts.add(Number(msg.accountId));
        }
      }
      if (msg.type === 'unsubscribe' && msg.accountId) {
        const client = wsClients.get(ws);
        if (client) {
          client.subscribedAccounts.delete(Number(msg.accountId));
        }
      }
    } catch (e) { /* ignore */ }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
  });

  ws.on('pong', () => {
    // 心跳回复
  });
});

// 心跳检测：每30秒ping一次，清理断开的连接
const heartbeatInterval = setInterval(() => {
  for (const [ws] of wsClients) {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      wsClients.delete(ws);
    }
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// ==================== 定期推送状态 ====================
// 每2秒向订阅的客户端推送运行中账号的状态
setInterval(() => {
  if (wsClients.size === 0) return;

  const processes = getAllProcesses();
  const statusByAccount = {};
  for (const p of processes) {
    statusByAccount[p.accountId] = {
      status: p.status,
      pid: p.pid,
      port: p.port,
    };
  }

  // 如果有进程在运行，推送状态
  if (processes.length > 0) {
    const msg = JSON.stringify({ type: 'status', data: statusByAccount });
    for (const [ws, client] of wsClients) {
      if (ws.readyState === ws.OPEN && client.subscribedAccounts.size > 0) {
        const relevant = {};
        for (const accId of client.subscribedAccounts) {
          if (statusByAccount[accId]) {
            relevant[accId] = statusByAccount[accId];
          }
        }
        if (Object.keys(relevant).length > 0) {
          ws.send(JSON.stringify({ type: 'status', data: relevant }));
        }
      }
    }
  }
}, 2000);

// ==================== 日志推送 ====================
// 每2秒向订阅的客户端推送新日志
setInterval(() => {
  for (const [ws, client] of wsClients) {
    if (ws.readyState !== ws.OPEN) continue;
    if (client.subscribedAccounts.size === 0) continue;

    for (const accId of client.subscribedAccounts) {
      const status = getGameStatus(accId);
      if (status.status !== 'running') continue;

      const logs = getGameLogs(accId, client._lastLogTime?.[accId]);
      if (logs.length === 0) continue;

      if (!client._lastLogTime) client._lastLogTime = {};
      client._lastLogTime[accId] = logs[logs.length - 1].time;

      ws.send(JSON.stringify({
        type: 'logs',
        accountId: accId,
        data: logs,
      }));
    }
  }
}, 2000);

// ==================== 启动服务器 ====================
async function start() {
  await initDatabase();

  // 重启之前运行中的游戏账号
  try {
    const runningAccounts = getRunningAccounts();
    if (runningAccounts.length > 0) {
      console.log(`发现 ${runningAccounts.length} 个运行中的账号，自动重启...`);
      for (const acc of runningAccounts) {
        try {
          await startGameAccount(acc);
          console.log(`  ✅ ${acc.nickname || acc.id} 已重启`);
        } catch (e) {
          console.log(`  ❌ ${acc.nickname || acc.id} 重启失败: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log(`自动重启账号失败: ${e.message}`);
  }

  server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  管理服务器已启动: http://localhost:${PORT}`);
    console.log(`  默认管理员: admin / admin123`);
    console.log(`  请立即登录并修改密码！`);
    console.log(`========================================`);
  });
}

start();

export { app, server, wss };
