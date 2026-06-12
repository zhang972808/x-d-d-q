import { Router } from 'express';
import { findUserByUsername, createUser, verifyPassword, changePassword, findUserById, addAuditLog } from '#server/database.js';
import { generateToken } from '#server/middleware.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.json({ code: 400, msg: '用户名和密码不能为空', data: null });
    }

    const user = findUserByUsername(username);
    if (!user) {
      return res.json({ code: 401, msg: '用户名或密码错误', data: null });
    }

    if (!verifyPassword(user, password)) {
      return res.json({ code: 401, msg: '用户名或密码错误', data: null });
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    addAuditLog(user.id, 'login', '用户登录');

    res.json({
      code: 200,
      msg: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          quota: user.quota,
        },
      },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;

    if (!username || !password) {
      return res.json({ code: 400, msg: '用户名和密码不能为空', data: null });
    }

    if (password !== confirmPassword) {
      return res.json({ code: 400, msg: '两次输入的密码不一致', data: null });
    }

    if (username.length < 3) {
      return res.json({ code: 400, msg: '用户名至少3个字符', data: null });
    }

    if (password.length < 6) {
      return res.json({ code: 400, msg: '密码至少6个字符', data: null });
    }

    const existing = findUserByUsername(username);
    if (existing) {
      return res.json({ code: 400, msg: '用户名已存在', data: null });
    }

    const userId = createUser(username, password, 'user', 5);
    const token = generateToken({ userId, username, role: 'user' });

    addAuditLog(userId, 'register', '用户注册');

    res.json({
      code: 200,
      msg: '注册成功',
      data: {
        token,
        user: { id: userId, username, role: 'user', quota: 5 },
      },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// POST /api/auth/reset - 重置密码（需要管理员操作）
router.post('/reset', (req, res) => {
  res.json({ code: 400, msg: '请联系管理员重置密码', data: null });
});

export default router;
