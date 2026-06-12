/**
 * 登录/注册页面 - v2
 */
(function () {
  'use strict';

  // 确保 DOM 加载完再绑定事件
  function init() {
    try {
      console.log('[login.js] 初始化开始, API=', typeof window.API);

      // 检查 API 是否可用
      if (!window.API) {
        showError('API模块加载失败，请硬刷新页面 (Ctrl+Shift+R)');
        return;
      }

      // 如果已登录直接跳转
      if (window.API.isLoggedIn) {
        console.log('[login.js] 已登录，跳转首页');
        window.location.href = '/index.html';
        return;
      }

      // 绑定事件
      bindEvents();
      console.log('[login.js] 事件绑定完成');
    } catch (e) {
      console.error('[login.js] 初始化错误:', e);
      showError('页面初始化失败: ' + e.message);
    }
  }

  function showError(msg) {
    var el = document.getElementById('debug-info');
    if (el) {
      el.style.display = 'block';
      el.textContent = '⚠️ ' + msg;
    }
    console.error(msg);
  }

  function bindEvents() {
    // Tab 切换
    var tabs = document.querySelectorAll('#authTabs .tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        var target = this.dataset.tab;
        var loginForm = document.getElementById('loginForm');
        var registerForm = document.getElementById('registerForm');
        if (loginForm) loginForm.style.display = (target === 'login') ? '' : 'none';
        if (registerForm) registerForm.style.display = (target === 'register') ? '' : 'none';
      });
    });

    // 登录表单
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
      console.log('[login.js] 登录表单事件已绑定');
    } else {
      showError('找不到登录表单元素 #loginForm');
    }

    // 注册表单
    var registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    console.log('[login.js] handleLogin 触发');

    var usernameEl = document.getElementById('loginUsername');
    var passwordEl = document.getElementById('loginPassword');
    var btnEl = document.getElementById('loginBtn');

    if (!usernameEl || !passwordEl) {
      showToast('页面元素异常，请刷新', 'error');
      return;
    }

    var username = usernameEl.value.trim();
    var password = passwordEl.value.trim();

    if (!username || !password) {
      showToast('请填写用户名和密码', 'warning');
      return;
    }

    showOverlay(true);
    if (btnEl) {
      btnEl.textContent = '登录中...';
      btnEl.disabled = true;
    }

    try {
      var resp = await window.API.post('/api/auth/login', { username: username, password: password });
      console.log('[login.js] 登录响应:', resp);
      if (resp.code === 200) {
        window.API.setToken(resp.data.token);
        window.API.setUser(resp.data.user);
        showToast('登录成功！', 'success');
        setTimeout(function () { window.location.href = '/index.html'; }, 500);
      } else {
        showToast(resp.msg || '登录失败', 'error');
      }
    } catch (err) {
      console.error('[login.js] 登录错误:', err);
      showToast('网络错误: ' + err.message, 'error');
    } finally {
      showOverlay(false);
      if (btnEl) {
        btnEl.textContent = '🚀 登 录';
        btnEl.disabled = false;
      }
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    console.log('[login.js] handleRegister 触发');

    var username = document.getElementById('regUsername');
    var password = document.getElementById('regPassword');
    var confirm = document.getElementById('regConfirm');
    var btnEl = document.getElementById('registerBtn');

    if (!username || !password || !confirm) {
      showToast('页面元素异常，请刷新', 'error');
      return;
    }

    var u = username.value.trim();
    var p = password.value.trim();
    var c = confirm.value.trim();

    if (!u || !p) { showToast('请填写用户名和密码', 'warning'); return; }
    if (p !== c) { showToast('两次输入的密码不一致', 'warning'); return; }
    if (p.length < 6) { showToast('密码至少6个字符', 'warning'); return; }

    showOverlay(true);
    if (btnEl) { btnEl.textContent = '注册中...'; btnEl.disabled = true; }

    try {
      var resp = await window.API.post('/api/auth/register', { username: u, password: p, confirmPassword: c });
      console.log('[login.js] 注册响应:', resp);
      if (resp.code === 200) {
        window.API.setToken(resp.data.token);
        window.API.setUser(resp.data.user);
        showToast('注册成功！', 'success');
        setTimeout(function () { window.location.href = '/index.html'; }, 500);
      } else {
        showToast(resp.msg || '注册失败', 'error');
      }
    } catch (err) {
      console.error('[login.js] 注册错误:', err);
      showToast('网络错误: ' + err.message, 'error');
    } finally {
      showOverlay(false);
      if (btnEl) { btnEl.textContent = '📝 注 册'; btnEl.disabled = false; }
    }
  }

  function showToast(msg, type) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }

  function showOverlay(show) {
    var el = document.getElementById('overlay');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
