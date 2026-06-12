import { session, api, overlay, toast, WebSocketManager } from "./common.js";

// WebSocket
const wsManager = new WebSocketManager();

// 缓存DOM元素
const DOM = {
  connectionStatus: document.querySelector(".connection-status"),
  logContainer: document.getElementById("logContainer"),
  userInfo: document.getElementById("userInfo"),
  userAvatar: document.querySelector("#userInfo img"),
  userName: document.getElementById("userName"),
  playerBelong: document.getElementById("playerBelong"),
  playerId: document.getElementById("playerId"),
  connectionState: document.getElementById("connectionState"),
  logOutput: document.getElementById("logOutput"),
  logToggleBtn: document.getElementById("logToggleBtn"),
  configBtn: document.querySelector(".config-btn"),
  startBtn: document.querySelector(".start-btn"),
  logoutBtn: document.querySelector(".logout-btn"),
  manualReconnect: document.getElementById("manualReconnect"),
};

// 初始化页面
function initializePage() {
  const userSession = session.getUserSession();

  // 显示基础UI元素
  DOM.connectionStatus.style.display = "flex";
  DOM.logContainer.style.display = "none";
  DOM.userInfo.style.display = "block";

  if (userSession?.serverStart) {
    updateUserInterface();
    connectWebSocket(userSession);
    disableGameControls();
  } else {
    setDefaultUIState();
    showWelcomeMessage();
  }

  overlay.hide();
}

// 更新用户界面
function updateUserInterface() {
  const userInfo = session.getUserInfo();
  if (!userInfo) {
    setDefaultUIState();
  } else {
    DOM.userAvatar.src = userInfo.wxHeadUrl || "/assets/default-avatar.svg";
    DOM.userName.textContent = userInfo.nickName;
    DOM.playerBelong.textContent = `📍 ${userInfo.playerBelong}`;
    DOM.playerId.textContent = userInfo.playerId;
  }
}

// 连接WebSocket
function connectWebSocket(userSession) {
  if (!userSession?.baseUrl || !userSession?.playerId) return;
  wsManager.connect(
    `ws://${userSession.baseUrl}/ws?userId=${userSession.playerId}&token=${userSession.jwtToken}`
  );
}

// 禁用游戏控制按钮
function disableGameControls() {
  DOM.configBtn.disabled = true;
  DOM.startBtn.disabled = true;
}

// 设置默认UI状态
function setDefaultUIState() {
  DOM.userAvatar.src = "/assets/default-avatar.png";
  DOM.userName.textContent = "未知用户";
  DOM.playerBelong.textContent = "位置";
  DOM.playerId.textContent = "#";
  DOM.connectionState.textContent = "未连接";
  DOM.connectionStatus.setAttribute("data-status", "disconnected");
}

// 显示欢迎信息
function showWelcomeMessage() {
  if (DOM.logOutput) {
    DOM.logOutput.innerHTML =
      '<div class="log"><span style="color: #3498db; font-weight: 600;">[INFO]</span> 欢迎使用！初次启动请先配置，然后再启动游戏！';
  }
}

// 配置页面跳转
function openConfig() {
  window.location.href = "/loader/config.html";
}

// 登出处理
async function logout() {
  try {
    const userSession = session.getUserSession();
    if (!userSession || !userSession.playerId) {
      throw new Error("No active session");
    }

    const data = await api.logout(userSession.playerId);
    if (data.logout) {
      // 保留登录凭证，只标记为未启动，下次可直接启动
      userSession.serverStart = false;
      session.setUserSession(userSession);
      wsManager.close();
      DOM.configBtn.disabled = false;
      DOM.startBtn.disabled = false;
      DOM.connectionState.textContent = "未连接";
      DOM.connectionStatus.setAttribute("data-status", "disconnected");
      toast.success("🔒 已退出，可随时重新启动");
    } else {
      toast.error("⚠️ Logout failed");
    }
  } catch (error) {
    toast.error(`❌ Error: ${error.message}`);
  }
}

// 启动游戏
async function startGame() {
  overlay.show();
  try {
    const userSession = session.getUserSession();

    const response = await api.startgame(
      userSession?.wsAddress || "",
      userSession?.playerId || "",
      userSession?.token || ""
    );

    if (response?.success) {
      // 服务端返回了新的凭证则更新
      if (response.playerId) {
        userSession.playerId = response.playerId;
        userSession.token = response.token;
        userSession.wsAddress = response.wsAddress;
      }
      userSession.serverStart = true;
      session.setUserSession(userSession);

      connectWebSocket(userSession);
      disableGameControls();
      toast.success("🎮 游戏启动成功");
    } else {
      toast.error(`❌ Error: ${response?.message || response?.error}`);
    }
  } catch (error) {
    toast.error(`🎮 游戏启动失败 ！${error.message}`);
  } finally {
    overlay.hide();
  }
}

// 手动重连
function handleManualReconnect() {
  const userSession = session.getUserSession();
  if (userSession?.playerId) {
    connectWebSocket(userSession);
    disableGameControls();
  }
}

// 初始化事件绑定
function initEvents() {
  DOM.configBtn?.addEventListener("click", openConfig);
  DOM.startBtn?.addEventListener("click", startGame);
  DOM.logoutBtn?.addEventListener("click", logout);
  DOM.manualReconnect?.addEventListener("click", handleManualReconnect);
  DOM.logToggleBtn?.addEventListener("click", toggleLog);
}

// 切换日志显示
function toggleLog() {
  const container = DOM.logContainer;
  const btn = DOM.logToggleBtn;
  if (!container || !btn) return;
  if (container.style.display === "none") {
    container.style.display = "flex";
    btn.classList.add("active");
    btn.textContent = "📋 隐藏日志";
  } else {
    container.style.display = "none";
    btn.classList.remove("active");
    btn.textContent = "📋 日志";
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  if (!session.checkLogin()) return;
  initializePage();
  initEvents();
});
