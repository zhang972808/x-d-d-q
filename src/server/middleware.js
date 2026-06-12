import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'xddq-server-secret-key-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// JWT 认证中间件
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, msg: '未登录，请先登录', data: null });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ code: 401, msg: '登录已过期，请重新登录', data: null });
  }

  req.user = decoded;
  next();
}

// 管理员权限中间件
export function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, msg: '权限不足，需要管理员权限', data: null });
  }
  next();
}

// 可选的认证（不强制，但如果有token就解析）
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}

export { JWT_SECRET };
