import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/xddq.db');

let db = null;
let SQL = null;

// ==================== 初始化 ====================

export async function initDatabase() {
  SQL = await initSqlJs();

  // 确保 data 目录存在
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 加载已有的数据库文件
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('[数据库] 已加载现有数据库');
  } else {
    db = new SQL.Database();
    console.log('[数据库] 创建新数据库');
  }

  // 建表
  db.run('PRAGMA journal_mode=OFF');
  db.run('PRAGMA foreign_keys=ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT \'user\',
      quota INTEGER DEFAULT 5,
      invite_code TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS game_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nickname TEXT DEFAULT \'\',
      server_id TEXT NOT NULL DEFAULT \'\',
      game_username TEXT NOT NULL DEFAULT \'\',
      game_password TEXT NOT NULL DEFAULT \'\',
      token TEXT DEFAULT \'\',
      uid TEXT DEFAULT \'\',
      platform TEXT DEFAULT \'qq\',
      status TEXT DEFAULT \'stopped\',
      pid INTEGER DEFAULT NULL,
      port INTEGER DEFAULT NULL,
      config TEXT DEFAULT \'{}\',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      game_account_id INTEGER,
      action TEXT NOT NULL,
      details TEXT DEFAULT \'\',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT \'\',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDb();
  initDefaultAdmin();
}

// 保存数据库到文件
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// 将 sql.js 的 exec 结果转为对象数组
function execAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function execOne(sql, params = []) {
  const rows = execAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execRun(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDb();
}

// ==================== 用户操作 ====================

export function findUserByUsername(username) {
  return execOne('SELECT * FROM users WHERE username = ?', [username]);
}

export function findUserById(id) {
  return execOne('SELECT id, username, role, quota, invite_code, created_at FROM users WHERE id = ?', [id]);
}

export function createUser(username, password, role = 'user', quota = 5) {
  const hash = bcrypt.hashSync(password, 10);
  execRun('INSERT INTO users (username, password_hash, role, quota) VALUES (?, ?, ?, ?)',
    [username, hash, role, quota]);
  // 回查获取插入的ID（sql.js 的 last_insert_rowid 不可靠）
  const u = findUserByUsername(username);
  return u ? u.id : null;
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

export function changePassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  return execRun('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [hash, userId]);
}

export function updateUserQuota(userId, quota) {
  return execRun('UPDATE users SET quota = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [quota, userId]);
}

export function updateUserRole(userId, role) {
  return execRun('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
}

export function deleteUser(userId) {
  return execRun('DELETE FROM users WHERE id = ?', [userId]);
}

export function listUsers() {
  return execAll('SELECT id, username, role, quota, created_at FROM users ORDER BY id DESC');
}

export function getUserCount() {
  const row = execOne('SELECT COUNT(*) as count FROM users');
  return row ? row.count : 0;
}

// ==================== 游戏账号操作 ====================

export function getAccountsByUserId(userId) {
  return execAll('SELECT * FROM game_accounts WHERE user_id = ? ORDER BY id ASC', [userId]);
}

export function getAccountById(id) {
  return execOne('SELECT * FROM game_accounts WHERE id = ?', [id]);
}

export function createAccount(userId, data) {
  const { nickname = '', server_id = '', game_username = '', game_password = '',
    token = '', uid = '', platform = 'qq', config = '{}' } = data;
  const configStr = typeof config === 'string' ? config : JSON.stringify(config);
  execRun(
    `INSERT INTO game_accounts (user_id, nickname, server_id, game_username, game_password, token, uid, platform, config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, nickname, server_id, game_username, game_password, token, uid, platform, configStr]
  );
  // 回查获取插入的ID：取该用户最新创建的账号
  const accounts = getAccountsByUserId(userId);
  return accounts.length > 0 ? accounts[accounts.length - 1].id : null;
}

export function updateAccount(id, data) {
  const account = getAccountById(id);
  if (!account) return null;
  const merged = {
    nickname: data.nickname ?? account.nickname,
    server_id: data.server_id ?? account.server_id,
    game_username: data.game_username ?? account.game_username,
    game_password: data.game_password ?? account.game_password,
    token: data.token ?? account.token,
    uid: data.uid ?? account.uid,
    platform: data.platform ?? account.platform,
    config: typeof data.config === 'string' ? data.config : (data.config ? JSON.stringify(data.config) : account.config),
  };
  execRun(
    `UPDATE game_accounts SET nickname=?, server_id=?, game_username=?, game_password=?,
     token=?, uid=?, platform=?, config=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [merged.nickname, merged.server_id, merged.game_username, merged.game_password,
      merged.token, merged.uid, merged.platform, merged.config, id]
  );
  return true;
}

export function updateAccountStatus(id, status, pid = null, port = null) {
  execRun('UPDATE game_accounts SET status=?, pid=?, port=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status, pid, port, id]);
}

export function updateAccountToken(id, token, uid, nickname) {
  execRun('UPDATE game_accounts SET token=?, uid=?, nickname=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [token, uid, nickname, id]);
}

export function deleteAccount(id) {
  execRun('DELETE FROM game_accounts WHERE id = ?', [id]);
}

export function getAccountCountByUser(userId) {
  const row = execOne('SELECT COUNT(*) as count FROM game_accounts WHERE user_id = ?', [userId]);
  return row ? row.count : 0;
}

// 获取所有状态为 running 的游戏账号
export function getRunningAccounts() {
  return execAll('SELECT * FROM game_accounts WHERE status = ?', ['running']);
}

// ==================== 审计日志 ====================

export function addAuditLog(userId, action, details = '', gameAccountId = null) {
  execRun('INSERT INTO audit_logs (user_id, game_account_id, action, details) VALUES (?, ?, ?, ?)',
    [userId, gameAccountId, action, details]);
}

export function getAuditLogs(limit = 100, offset = 0) {
  return execAll('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
}

// ==================== 公告 ====================

export function getActiveNotices() {
  return execAll('SELECT * FROM notices WHERE enabled = 1 ORDER BY created_at DESC');
}

export function getAllNotices() {
  return execAll('SELECT * FROM notices ORDER BY created_at DESC');
}

export function createNotice(title, content, enabled = 1) {
  execRun('INSERT INTO notices (title, content, enabled) VALUES (?, ?, ?)', [title, content, enabled]);
  const notices = getAllNotices();
  return notices.length > 0 ? notices[0].id : null;
}

export function updateNotice(id, title, content, enabled) {
  execRun('UPDATE notices SET title=?, content=?, enabled=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title, content, enabled, id]);
}

export function deleteNotice(id) {
  execRun('DELETE FROM notices WHERE id = ?', [id]);
}

// ==================== 默认管理员 ====================

function initDefaultAdmin() {
  const count = getUserCount();
  if (count === 0) {
    const adminPwd = process.env.ADMIN_PASSWORD || 'admin123';
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    createUser(adminUser, adminPwd, 'admin', 999);
    console.log(`[数据库] 已创建默认管理员: ${adminUser} / ${adminPwd}`);
    console.log('[数据库] 请立即登录并修改密码！');
  }
}
