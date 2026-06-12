import { Router } from 'express';
import {
  getAccountsByUserId, getAccountById, createAccount,
  updateAccount, deleteAccount, addAuditLog,
  getAccountCountByUser, findUserById,
} from '#server/database.js';
import { stopGameAccount, getGameStatus } from '#server/processManager.js';

const router = Router();

// 检查配额中间件
function checkQuota(req, res, next) {
  const user = findUserById(req.user.userId);
  if (!user) {
    return res.json({ code: 404, msg: '用户不存在', data: null });
  }
  const used = getAccountCountByUser(req.user.userId);
  if (used >= user.quota) {
    return res.json({
      code: 400,
      msg: `账号数量已达上限 (${used}/${user.quota})，请联系管理员扩容`,
      data: null,
    });
  }
  next();
}

// GET /api/sub-user/ - 获取所有游戏账号
router.get('/', (req, res) => {
  try {
    const accounts = getAccountsByUserId(req.user.userId);
    res.json({
      code: 200,
      msg: '',
      data: accounts,
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// POST /api/sub-user/ - 创建游戏账号
router.post('/', checkQuota, (req, res) => {
  try {
    const { nickname, server_id, game_username, game_password, platform, config } = req.body;

    if (!game_username || !game_password) {
      return res.json({ code: 400, msg: '游戏账号和密码不能为空', data: null });
    }

    const id = createAccount(req.user.userId, {
      nickname: nickname || game_username,
      server_id: server_id || '',
      game_username,
      game_password,
      platform: platform || 'qq',
      config: config || {},
    });

    addAuditLog(req.user.userId, 'create_account', `创建游戏账号: ${nickname || game_username}`, id);

    res.json({
      code: 200,
      msg: '创建成功',
      data: { id, ...getAccountById(id) },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/sub-user/:id - 获取游戏账号详情
router.get('/:id', (req, res) => {
  try {
    const account = getAccountById(Number(req.params.id));
    if (!account) {
      return res.json({ code: 404, msg: '账号不存在', data: null });
    }
    if (account.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.json({ code: 403, msg: '无权访问', data: null });
    }

    const rtStatus = getGameStatus(account.id);
    res.json({
      code: 200,
      msg: '',
      data: { ...account, ...rtStatus },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// PUT /api/sub-user/:id - 更新游戏账号
router.put('/:id', (req, res) => {
  try {
    const accountId = Number(req.params.id);
    const account = getAccountById(accountId);
    if (!account) {
      return res.json({ code: 404, msg: '账号不存在', data: null });
    }
    if (account.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.json({ code: 403, msg: '无权操作', data: null });
    }

    updateAccount(accountId, req.body);
    addAuditLog(req.user.userId, 'update_account', `更新游戏账号: ${account.nickname}`, accountId);

    res.json({
      code: 200,
      msg: '更新成功',
      data: getAccountById(accountId),
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// DELETE /api/sub-user/:id - 删除游戏账号
router.delete('/:id', async (req, res) => {
  try {
    const accountId = Number(req.params.id);
    const account = getAccountById(accountId);
    if (!account) {
      return res.json({ code: 404, msg: '账号不存在', data: null });
    }
    if (account.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.json({ code: 403, msg: '无权操作', data: null });
    }

    // 如果正在运行，先停止
    const rtStatus = getGameStatus(accountId);
    if (rtStatus.status === 'running') {
      try { await stopGameAccount(accountId); } catch (e) { /* ignore */ }
    }

    deleteAccount(accountId);
    addAuditLog(req.user.userId, 'delete_account', `删除游戏账号: ${account.nickname}`, accountId);

    res.json({ code: 200, msg: '删除成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/sub-user/:id/setting - 获取游戏配置
router.get('/:id/setting', (req, res) => {
  try {
    const account = getAccountById(Number(req.params.id));
    if (!account) return res.json({ code: 404, msg: '账号不存在', data: null });
    if (account.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.json({ code: 403, msg: '无权访问', data: null });
    }

    let config;
    try {
      config = typeof account.config === 'string' ? JSON.parse(account.config) : account.config;
    } catch (e) {
      config = {};
    }

    res.json({
      code: 200, msg: '',
      data: {
        ...config,
        serverId: account.server_id,
        username: account.game_username,
        password: account.game_password,
        token: account.token,
        uid: account.uid,
        nickName: account.nickname,
      },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// PUT /api/sub-user/:id/setting - 保存游戏配置
router.put('/:id/setting', (req, res) => {
  try {
    const accountId = Number(req.params.id);
    const account = getAccountById(accountId);
    if (!account) return res.json({ code: 404, msg: '账号不存在', data: null });
    if (account.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.json({ code: 403, msg: '无权操作', data: null });
    }

    const newConfig = { ...req.body };
    const baseFields = ['serverId', 'username', 'password', 'token', 'uid', 'nickName'];
    const baseUpdates = {};
    for (const f of baseFields) {
      if (newConfig[f] !== undefined) {
        baseUpdates[f] = newConfig[f];
        delete newConfig[f];
      }
    }

    updateAccount(accountId, {
      nickname: baseUpdates.nickName,
      server_id: baseUpdates.serverId,
      game_username: baseUpdates.username,
      game_password: baseUpdates.password,
      token: baseUpdates.token,
      uid: baseUpdates.uid,
      config: newConfig,
    });

    res.json({ code: 200, msg: '配置保存成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// POST /api/sub-user/bind - 绑定子账号（占位）
router.post('/bind', (req, res) => {
  res.json({ code: 200, msg: '', data: null });
});

// GET /api/sub-user/delete-records - 删除记录（占位）
router.get('/delete-records', (req, res) => {
  res.json({ code: 200, msg: '', data: [] });
});

export default router;
