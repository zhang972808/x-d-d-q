import dependencyInjectorLoader from "#loaders/dependencyInjector.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import logger, { setWebSocket } from "#utils/logger.js";
import AuthService, { updateAccount } from "#services/authService.js";
import { getConfig, saveConfig, deepMerge } from "#loaders/configApi.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";
import TokenManager from "#utils/tokenManager.js";
import createPath from "#utils/path.js";
import SyncMgr from "#game/common/SyncMgr.js";
import { updateWs as updateStatusWs, startStatusReport } from "#game/common/StatusReporter.js";

const resolvePath = createPath(import.meta.url);
const dataDir = resolvePath("../../data");

// 确保 data 目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Token验证中间件
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization || req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token is required" });
  }

  if (!TokenManager.isTokenValid(token)) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Token is invalid or expired" });
  }

  next();
};

export default async () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // 静态文件服务 - 前端页面
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.resolve(__dirname, "../../public")));

  // GET /api/servers - 获取服务器列表
  app.get("/api/servers", async (req, res) => {
    const { username, password, token } = req.query;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // token 验证
    let configToken = global.account.loginToken;
    if (configToken && token != configToken) {
      return res.status(400).json({ error: "invalid token !" });
    }

    try {
      const authServiceInstance = new AuthService();
      const serverList = await authServiceInstance.List(username, password);
      return res.json(serverList);
    } catch (error) {
      logger.error(error.message || error);
      return res.status(500).json({ error: "Failed to fetch server list" });
    }
  });

  // 登录接口
  app.post("/api/login", async (req, res) => {
    const { username, password, serverId } = req.body;

    try {
      // 发起登陆
      const { wsAddress, playerId, token } = await GameNetMgr.inst.doLogin({
        serverId: serverId,
        username: username,
        password: password,
      });

      try {
        // 更新 account.json
        const filePath = global.configFile;
        const newObject = {
          serverId: serverId,
          username: username,
          password: password,
          uid: playerId,
          token: token,
        };
        await updateAccount(filePath, newObject);
        logger.info("更新配置文件成功，已写入相应参数.");

        // 同时保存到 data/ 目录，保留完整配置（以nickName命名）
        const nickName = (global.account.nickName || `${serverId}_${username}`)
          .replace(/[<>:"/\\|?*]/g, "_");
        const accountFile = path.join(dataDir, `${nickName}.json`);
        // 先读取已有文件（存在则合并），避免覆盖已有配置
        let existingAccount = {};
        try {
          if (fs.existsSync(accountFile)) {
            existingAccount = JSON.parse(fs.readFileSync(accountFile, "utf8"));
          }
        } catch (_) {}
        const savedAccount = {
          ...global.account,
          ...existingAccount,
          serverId,
          username,
          password,
          uid: playerId,
          token,
        };
        fs.writeFileSync(accountFile, JSON.stringify(savedAccount, null, 4), 'utf8');
        logger.info(`账号已保存到 ${accountFile}`);
      } catch (error) {
        logger.error(`更新配置文件失败，${error.message}.`);
      }

      // 生成JWT token
      const jwtToken = TokenManager.generateToken({
        playerId,
        username,
        serverId,
      });

      // 自动连接游戏服务器
      GameNetMgr.inst.connectGameServer(wsAddress, playerId, token);
      logger.info("[API] 登录成功，已自动连接游戏服务器");

      // 返回登录成功信息
      res.json({
        playerId,
        token: token,
        jwtToken: jwtToken,
        wsAddress,
        message: "Login successful. WebSocket connection will be established.",
      });
    } catch (error) {
      // 登陆失败，清理参数
      await localLogout();

      logger.error("Login failed", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 退出登陆
  app.post("/api/logout", authMiddleware, async (req, res) => {
    const { playerId } = req.body;
    if (playerId) {
      GameNetMgr.inst.isManualClose = true;
      LoopMgr.inst.end();
      GameNetMgr.inst.close();

      await localLogout();

      const logout = true;
      res.json({ logout });
    } else {
      res.status(500).json({ error: "request failed" });
    }
  });

  // 获取配置
  app.get("/api/config", authMiddleware, async (req, res) => {
    try {
      const filePath = global.configFile;
      const config = await getConfig(filePath);
      res.json(config);
    } catch (error) {
      logger.error(`获取配置失败: ${error.message}`);
      res.status(500).json({ error: "Failed to get configuration" });
    }
  });

  // 保存配置
  app.post("/api/config", authMiddleware, async (req, res) => {
    try {
      const filePath = global.configFile;
      const config = req.body;

      // 保存配置到当前账号文件
      const result = await saveConfig(filePath, config);

      // 同步更新内存中的 global.account，使配置立即生效无需重启
      deepMerge(global.account, config);
      logger.info("内存配置已同步更新");

      res.json(result);
    } catch (error) {
      logger.error(`保存配置失败: ${error.message}`);
      res.status(500).json({ error: "Failed to save configuration" });
    }
  });

  // 启动游戏连接
  app.post("/api/start", authMiddleware, async (req, res) => {
    try {
      const { token, wsAddress, playerId } = req.body;

      // 先清理旧状态
      GameNetMgr.inst.isManualClose = true;
      LoopMgr.inst.end();
      GameNetMgr.inst.close();
      RegistMgr.inst.reset();

      // 如果传了有效凭证，直接用
      if (playerId && token && wsAddress) {
        GameNetMgr.inst.connectGameServer(wsAddress, playerId, token);
        logger.info("Server started successfully.");
        return res.json({ success: true, message: "Server started successfully" });
      }

      // 没有凭证，从 account.json 读取账号密码重新登录
      const account = global.account || {};
      if (account.serverId && account.username && account.password) {
        logger.info("[Start] 无有效凭证，使用保存的账号重新登录...");
        const result = await GameNetMgr.inst.doLogin({
          serverId: account.serverId,
          username: account.username,
          password: account.password,
        });
        GameNetMgr.inst.connectGameServer(result.wsAddress, result.playerId, result.token);
        return res.json({
          playerId: result.playerId,
          token: result.token,
          wsAddress: result.wsAddress,
          message: "Re-login and server started successfully.",
        });
      }

      return res.status(400).json({ message: "无有效凭证且无已保存账号，请先登录" });
    } catch (error) {
      logger.error(`启动服务器失败: ${error.message}`);
      res.status(500).json({ message: `${error.message}` });
    }
  });

  // 清理 account（保留账号密码，只清登录态）
  async function localLogout() {
    const filePath = global.configFile;

    const newObject = {
      uid: "",
      token: "",
    };

    await updateAccount(filePath, newObject);
  }

  // 启动服务器
  const startServer = async () => {
    await dependencyInjectorLoader();

    // 初始化多账号同步
    const syncMode = global.account?.switch?.syncMode;
    if (syncMode) {
      if (global.port === 8082) {
        SyncMgr.inst.startAsMaster();
      } else {
        SyncMgr.inst.setSendFn(
          (msgId, msgData) => GameNetMgr.inst.sendPbMsg(msgId, msgData, true)
        );
        SyncMgr.inst.startAsSlave();
      }
    }

    const port = global.port || 8082;
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    // 自动连接游戏（有账号密码就自动登录）
    const account = global.account || {};
    if (account.serverId && account.username && account.password) {
      logger.info("[自动连接] 检测到账号信息，自动连接游戏...");
      try {
        const result = await GameNetMgr.inst.doLogin({
          serverId: account.serverId,
          username: account.username,
          password: account.password,
        });
        GameNetMgr.inst.connectGameServer(result.wsAddress, result.playerId, result.token);
        logger.info(`[自动连接] 登录成功，角色: ${result.nickName}`);
      } catch (e) {
        logger.warn(`[自动连接] 自动登录失败: ${e.message}，可通过 UI 手动登录`);
      }
    }

    // 在启动服务器后创建 WebSocketServer 实例
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws) => {
      // 发送测试消息
      ws.send(JSON.stringify({ level: "info", message: "New WebSocket connection established." }));

      // 心跳检测
      const heartbeat = setInterval(() => ws.ping(), 30000);

      // 链接成功，保持心跳
      setWebSocket(ws);
      updateStatusWs(ws);
      startStatusReport();

      // 可在这里添加 ws 的事件监听器，例如 message, close 等
      ws.on("message", (message) => {
        console.log(`Received message from client: ${message.toString()}`);
      });

      ws.on("close", () => {
        logger.error("ui webSocket disconnected .");
        clearInterval(heartbeat);
        // GameNetMgr.inst.close();
      });
    });

    // 处理 HTTP 升级请求
    server.on("upgrade", (request, socket, head) => {
      // 从请求中提取用户信息（假设用户信息已经附加到请求对象中）

      const { pathname, searchParams } = new URL(
        request.url,
        `http://${request.headers.host}`
      );
      const userId = searchParams.get("userId");
      const token = searchParams.get("token");

      if (
        pathname == "/ws" &&
        userId &&
        token &&
        TokenManager.isTokenValid(token)
      ) {
        // 在异步上下文中存储用户信息
        // const store = asyncLocalStorage.getStore();
        // store.set('userId', userId);

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        socket.destroy(); // 如果没有用户信息，拒绝升级
      }
    });
  };

  startServer();
};
