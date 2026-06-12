import { Router } from 'express';
import {
  findUserById, findUserByUsername, changePassword,
  verifyPassword, addAuditLog, getAccountsByUserId,
  getAccountCountByUser,
} from '#server/database.js';

const router = Router();

// GET /api/user/quota
router.get('/quota', (req, res) => {
  try {
    const user = findUserById(req.user.userId);
    if (!user) {
      return res.json({ code: 404, msg: '用户不存在', data: null });
    }
    const usedCount = getAccountCountByUser(req.user.userId);
    res.json({
      code: 200,
      msg: '',
      data: { quota: user.quota, used: usedCount, available: user.quota - usedCount },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/user/stats
router.get('/stats', (req, res) => {
  try {
    const accounts = getAccountsByUserId(req.user.userId);
    const total = accounts.length;
    const running = accounts.filter(a => a.status === 'running').length;
    const stopped = accounts.filter(a => a.status === 'stopped').length;
    res.json({
      code: 200,
      msg: '',
      data: { total, running, stopped },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/user/invite-code
router.get('/invite-code', (req, res) => {
  const user = findUserById(req.user.userId);
  res.json({
    code: 200,
    msg: '',
    data: { invite_code: user?.invite_code || '' },
  });
});

// PUT /api/user/password
router.put('/password', (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.json({ code: 400, msg: '请提供旧密码和新密码', data: null });
    }
    if (newPassword.length < 6) {
      return res.json({ code: 400, msg: '新密码至少6个字符', data: null });
    }

    const user = findUserById(req.user.userId);
    const fullUser = findUserByUsername(user.username);
    if (!verifyPassword(fullUser, oldPassword)) {
      return res.json({ code: 400, msg: '旧密码错误', data: null });
    }

    changePassword(req.user.userId, newPassword);
    addAuditLog(req.user.userId, 'change_password', '修改密码');

    res.json({ code: 200, msg: '密码修改成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/user/sub-users - 获取用户的游戏账号列表
router.get('/sub-users', (req, res) => {
  try {
    const accounts = getAccountsByUserId(req.user.userId);
    res.json({
      code: 200,
      msg: '',
      data: accounts.map(a => ({
        id: a.id,
        nickname: a.nickname,
        server_id: a.server_id,
        game_username: a.game_username,
        platform: a.platform,
        status: a.status,
        pid: a.pid,
        port: a.port,
        uid: a.uid,
        created_at: a.created_at,
      })),
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

export default router;
