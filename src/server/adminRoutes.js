import { Router } from 'express';
import { adminMiddleware } from '#server/middleware.js';
import {
  listUsers, findUserById, updateUserQuota, updateUserRole,
  deleteUser, addAuditLog, getAuditLogs, getUserCount,
  getAllNotices, createNotice, updateNotice, deleteNotice,
  getAccountsByUserId, changePassword,
} from '#server/database.js';

const router = Router();

// 所有 admin 路由需要管理员权限
router.use(adminMiddleware);

// GET /api/admin/user/list
router.get('/user/list', (req, res) => {
  try {
    const users = listUsers();
    res.json({
      code: 200,
      msg: '',
      data: users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        quota: u.quota,
        created_at: u.created_at,
      })),
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// PUT /api/admin/user/:id - 更新用户（配额、角色）
router.put('/user/:id', (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = findUserById(userId);
    if (!user) {
      return res.json({ code: 404, msg: '用户不存在', data: null });
    }

    const { quota, role } = req.body;
    if (quota !== undefined) {
      updateUserQuota(userId, quota);
    }
    if (role) {
      updateUserRole(userId, role);
    }
    addAuditLog(req.user.userId, 'admin_update_user', `更新用户: ${user.username}`);

    res.json({ code: 200, msg: '更新成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// DELETE /api/admin/user/:id - 删除用户
router.delete('/user/:id', (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = findUserById(userId);
    if (!user) {
      return res.json({ code: 404, msg: '用户不存在', data: null });
    }
    if (user.role === 'admin') {
      return res.json({ code: 400, msg: '不能删除管理员', data: null });
    }

    deleteUser(userId);
    addAuditLog(req.user.userId, 'admin_delete_user', `删除用户: ${user.username}`);

    res.json({ code: 200, msg: '删除成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  try {
    const userCount = getUserCount();
    const users = listUsers();
    let totalAccounts = 0;
    for (const u of users) {
      totalAccounts += getAccountsByUserId(u.id).length;
    }
    res.json({
      code: 200,
      msg: '',
      data: { userCount, totalAccounts },
    });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/admin/notices
router.get('/notices', (req, res) => {
  try {
    const notices = getAllNotices();
    res.json({ code: 200, msg: '', data: notices });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// POST /api/admin/notice
router.post('/notice', (req, res) => {
  try {
    const { title, content, enabled } = req.body;
    if (!title) {
      return res.json({ code: 400, msg: '标题不能为空', data: null });
    }
    createNotice(title, content || '', enabled !== undefined ? enabled : 1);
    addAuditLog(req.user.userId, 'create_notice', `发布公告: ${title}`);
    res.json({ code: 200, msg: '发布成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// DELETE /api/admin/notice
router.delete('/notice', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.json({ code: 400, msg: '缺少公告ID', data: null });
    }
    deleteNotice(id);
    addAuditLog(req.user.userId, 'delete_notice', `删除公告: ${id}`);
    res.json({ code: 200, msg: '删除成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', (req, res) => {
  try {
    const logs = getAuditLogs(200, 0);
    res.json({ code: 200, msg: '', data: logs });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// GET /api/admin/sub-users
router.get('/sub-users', (req, res) => {
  try {
    const users = listUsers();
    const allAccounts = [];
    for (const u of users) {
      const accounts = getAccountsByUserId(u.id);
      for (const a of accounts) {
        allAccounts.push({ ...a, owner: u.username });
      }
    }
    res.json({ code: 200, msg: '', data: allAccounts });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

// 预留的其他 admin 端点（返回空数据）
router.get('/orders', (req, res) => res.json({ code: 200, msg: '', data: [] }));
router.get('/agent/stats', (req, res) => res.json({ code: 200, msg: '', data: { profit: 0, total: 0 } }));
router.get('/monthly-revenue', (req, res) => res.json({ code: 200, msg: '', data: [] }));
router.get('/version', (req, res) => res.json({ code: 200, msg: '', data: { version: '1.0.0' } }));
router.post('/version', (req, res) => res.json({ code: 200, msg: '更新成功', data: null }));
router.get('/sub-pod', (req, res) => res.json({ code: 200, msg: '', data: { podList: [], count: 0 } }));
router.get('/node-metrics', (req, res) => res.json({ code: 200, msg: '', data: {} }));
router.post('/refund', (req, res) => res.json({ code: 200, msg: '退款已处理', data: null }));
router.post('/refund-only', (req, res) => res.json({ code: 200, msg: '仅退款已处理', data: null }));
router.post('/maintenance/status', (req, res) => res.json({ code: 200, msg: '', data: null }));
router.post('/assign/record', (req, res) => res.json({ code: 200, msg: '', data: null }));
router.post('/agent/transfer-stats', (req, res) => res.json({ code: 200, msg: '', data: null }));

// PUT /api/admin/user/:id/password - 管理员重置用户密码
router.put('/user/:id/password', (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = findUserById(userId);
    if (!user) return res.json({ code: 404, msg: '用户不存在', data: null });
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.json({ code: 400, msg: '密码至少6个字符', data: null });
    }
    changePassword(userId, password);
    addAuditLog(req.user.userId, 'admin_reset_password', `重置用户密码: ${user.username}`);
    res.json({ code: 200, msg: '密码重置成功', data: null });
  } catch (err) {
    res.json({ code: 500, msg: err.message, data: null });
  }
});

export default router;
