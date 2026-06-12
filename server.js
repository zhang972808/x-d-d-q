/**
 * 管理服务器入口
 * 用于多用户管理，提供前端界面和API，管理游戏脚本的启停
 *
 * 使用方式:
 *   node server.js
 *
 * 环境变量:
 *   MGMT_PORT=8080         管理服务器端口（默认8080）
 *   ADMIN_USERNAME=admin   初始管理员用户名
 *   ADMIN_PASSWORD=admin123 初始管理员密码
 *   JWT_SECRET=xxx         JWT密钥
 */

// 设置全局配置（兼容现有代码中的 global.account 引用）
global.account = global.account || {};
global.colors = {
  reset: '\x1b[0m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};
global.messageDelay = 20;
global.port = process.env.MGMT_PORT || 8080;

// 启动管理服务器
import '#server/server.js';
