/**
 * 控制台 — 游戏账号管理 v2
 */
(function () {
  'use strict';

  // 确保 DOM 加载完再初始化
  function init() {
    try {
      console.log('[dashboard] 初始化, API=', typeof window.API);

      if (!window.API) {
        alert('页面加载失败，请硬刷新 (Ctrl+Shift+R)');
        return;
      }

      if (!window.API.isLoggedIn) {
        window.location.href = '/login.html';
        return;
      }

      var user = window.API.getUser();
      var accounts = [];
      var logPollTimer = null;
      var currentLogAccount = null;

      // ==================== UI 辅助 ====================
      function $(id) { return document.getElementById(id); }

      // ==================== 加载账号列表 ====================
      async function loadAccounts() {
        try {
          var resp = await window.API.get('/api/user/sub-users');
          if (resp.code !== 200) {
            showToast('加载失败: ' + resp.msg, 'error');
            return;
          }
          accounts = resp.data || [];
          renderAccounts();
          loadQuota();
          startStatusPolling();
        } catch (e) {
          showToast('加载账号列表失败: ' + e.message, 'error');
        }
      }

      async function loadQuota() {
        try {
          var resp = await window.API.get('/api/user/quota');
          if (resp.code === 200) {
            var q = resp.data;
            var el = $('quotaInfo');
            if (el) el.textContent = '账号: ' + (q.used || 0) + ' / ' + (q.quota || 0);
          }
        } catch (e) {}
      }

      // ==================== 渲染账号列表 ====================
      function renderAccounts() {
        var container = $('accountList');
        if (!container) return;
        if (accounts.length === 0) {
          container.innerHTML = '<div class="empty-state">还没有游戏账号，点击"+ 添加账号"开始</div>';
          return;
        }

        container.innerHTML = accounts.map(function (a) {
          var statusClass = a.status === 'running' ? 'status-running' : 'status-stopped';
          var statusText = a.status === 'running' ? '运行中' : '已停止';
          var cpuInfo = a.status === 'running' ? 'PID: ' + (a.pid || '?') + ' Port: ' + (a.port || '?') : '';
          var name = esc(a.nickname || '未命名');
          return '<div class="account-card" data-id="' + a.id + '">' +
            '<div class="card-header">' +
              '<span class="card-name">' + name + '</span>' +
              '<span class="card-status ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<div class="card-body">' +
              '<div class="card-info">' +
                '<span>平台: ' + esc(a.platform || 'qq') + '</span>' +
                '<span>账号: ' + esc(a.game_username || '-') + '</span>' +
                '<span>服务器ID: ' + esc(a.server_id || '-') + '</span>' +
                (cpuInfo ? '<span class="card-pid">' + cpuInfo + '</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="card-actions">' +
              (a.status === 'running'
                ? '<button class="btn btn-danger btn-sm" data-action="stop" data-id="' + a.id + '">⏹ 停止</button>' +
                  '<button class="btn btn-sm" data-action="logs" data-id="' + a.id + '" data-name="' + escAttr(name) + '">📋 日志</button>'
                : '<button class="btn btn-success btn-sm" data-action="start" data-id="' + a.id + '">▶ 启动</button>'
              ) +
              '<button class="btn btn-sm" data-action="edit" data-id="' + a.id + '">✏ 编辑</button>' +
              '<button class="btn btn-sm" data-action="config" data-id="' + a.id + '">⚙ 配置</button>' +
              '<button class="btn btn-sm btn-del" data-action="delete" data-id="' + a.id + '">🗑 删除</button>' +
            '</div>' +
          '</div>';
        }).join('');

        // 事件委托：所有按钮点击
        container.onclick = function (e) {
          var btn = e.target.closest('[data-action]');
          if (!btn) return;
          var action = btn.dataset.action;
          var id = parseInt(btn.dataset.id);
          if (action === 'start') startAccount(id);
          else if (action === 'stop') stopAccount(id);
          else if (action === 'edit') editAccount(id);
          else if (action === 'config') openConfig(id);
          else if (action === 'logs') showLogs(id, btn.dataset.name);
          else if (action === 'delete') deleteAccount(id);
        };
      }

      function esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }
      function escAttr(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }

      // ==================== 状态轮询 ====================
      var statusInterval = null;
      function startStatusPolling() {
        if (statusInterval) clearInterval(statusInterval);
        statusInterval = setInterval(async function () {
          var runningIds = accounts.filter(function (a) { return a.status === 'running'; }).map(function (a) { return a.id; });
          if (runningIds.length === 0) return;
          try {
            var resp = await window.API.post('/api/common/status', { account_ids: runningIds });
            if (resp.code !== 200) return;
            var statuses = resp.data || {};
            var changed = false;
            accounts.forEach(function (a) {
              var s = statuses[a.id];
              if (s && a.status !== s.status) {
                a.status = s.status;
                a.pid = s.pid;
                a.port = s.port;
                changed = true;
              }
            });
            if (changed) renderAccounts();
          } catch (e) {}
        }, 3000);
      }

      // ==================== 操作 ====================
      async function startAccount(id) {
        showOverlay(true);
        try {
          var resp = await window.API.post('/api/kubernetes/run', { account_id: id });
          if (resp.code === 200) {
            showToast('启动成功', 'success');
            loadAccounts();
          } else {
            showToast('启动失败: ' + resp.msg, 'error');
          }
        } catch (e) {
          showToast('启动错误: ' + e.message, 'error');
        } finally {
          showOverlay(false);
        }
      }

      async function stopAccount(id) {
        if (!confirm('确定要停止该账号吗？')) return;
        showOverlay(true);
        try {
          var resp = await window.API.post('/api/kubernetes/stop', { account_id: id });
          if (resp.code === 200) {
            showToast('已停止', 'success');
            loadAccounts();
          } else {
            showToast('停止失败: ' + resp.msg, 'error');
          }
        } catch (e) {
          showToast('停止错误: ' + e.message, 'error');
        } finally {
          showOverlay(false);
        }
      }

      function editAccount(id) {
        var a = accounts.find(function (x) { return x.id === id; });
        if (!a) return;
        $('modalTitle').textContent = '编辑游戏账号';
        $('accId').value = a.id;
        $('accNickname').value = a.nickname || '';
        $('accPlatform').value = a.platform || 'qq';
        $('accUsername').value = a.game_username || '';
        $('accPassword').value = a.game_password || '';
        $('accServer').value = a.server_id || '';
        $('accountModal').style.display = 'flex';
      }

      function openConfig(id) {
        window.open('/loader/config.html?accountId=' + id, '_blank');
      }

      function showLogs(id, name) {
        currentLogAccount = id;
        $('logTitle').textContent = '运行日志 - ' + name;
        $('logContent').textContent = '加载中...';
        $('logModal').style.display = 'flex';
        pollLogs(id);
      }

      async function deleteAccount(id) {
        if (!confirm('确定要删除该账号吗？此操作不可恢复！')) return;
        try {
          var resp = await window.API.del('/api/sub-user/' + id);
          if (resp.code === 200) {
            showToast('已删除', 'success');
            loadAccounts();
          } else {
            showToast('删除失败: ' + resp.msg, 'error');
          }
        } catch (e) {
          showToast('删除错误: ' + e.message, 'error');
        }
      }

      async function pollLogs(accountId) {
        if (currentLogAccount !== accountId) return;
        var since = null;
        async function fetchLogs() {
          if (currentLogAccount !== accountId) return;
          try {
            var params = { account_id: accountId };
            if (since) params.since = since;
            var resp = await window.API.get('/api/kubernetes/log-stream-poll', params);
            if (resp.code === 200 && resp.data && resp.data.logs && resp.data.logs.length > 0) {
              var logs = resp.data.logs;
              since = logs[logs.length - 1].time;
              var el = $('logContent');
              var newLines = logs.map(function (l) { return '[' + l.time.slice(11, 19) + '] ' + l.message; }).join('\n');
              el.textContent += (el.textContent === '加载中...' ? '' : '\n') + newLines;
              el.scrollTop = el.scrollHeight;
            }
          } catch (e) {}
          logPollTimer = setTimeout(fetchLogs, 2000);
        }
        $('logContent').textContent = '';
        fetchLogs();
      }

      // ==================== 模态框 ====================
      var modalClose = $('modalClose');
      var modalCancel = $('modalCancel');
      if (modalClose) modalClose.onclick = function () { $('accountModal').style.display = 'none'; };
      if (modalCancel) modalCancel.onclick = function () { $('accountModal').style.display = 'none'; };

      var logClose = $('logClose');
      if (logClose) logClose.onclick = function () {
        $('logModal').style.display = 'none';
        currentLogAccount = null;
        if (logPollTimer) clearTimeout(logPollTimer);
      };

      // 添加账号按钮
      var addBtn = $('addAccountBtn');
      if (addBtn) addBtn.onclick = function () {
        $('modalTitle').textContent = '添加游戏账号';
        $('accId').value = '';
        $('accNickname').value = '';
        $('accPlatform').value = 'qq';
        $('accUsername').value = '';
        $('accPassword').value = '';
        $('accServer').innerHTML = '<option value="">-- 先获取服务器列表 --</option>';
        $('accServer').value = '';
        $('accountModal').style.display = 'flex';
      };

      // 获取服务器列表
      var fetchBtn = $('fetchServersBtn');
      if (fetchBtn) fetchBtn.onclick = async function () {
        var username = $('accUsername').value.trim();
        var password = $('accPassword').value.trim();
        if (!username || !password) {
          showToast('请先输入游戏账号和密码', 'error');
          return;
        }
        fetchBtn.textContent = '获取中...';
        fetchBtn.disabled = true;
        try {
          var resp = await window.API.get('/api/chan/qq/servers', { username: username, password: password });
          if (resp.code === 200 && resp.data && resp.data.server_list) {
            var servers = resp.data.server_list.servers || [];
            $('accServer').innerHTML = servers
              .map(function (s) { return '<option value="' + s.serverId + '">' + s.serverName + ' (' + s.serverId + ')</option>'; })
              .join('');
            showToast('获取到 ' + servers.length + ' 个服务器', 'success');
          } else {
            showToast('获取失败: ' + (resp.msg || '未知错误'), 'error');
          }
        } catch (e) {
          showToast('获取失败: ' + e.message, 'error');
        } finally {
          fetchBtn.textContent = '获取服务器';
          fetchBtn.disabled = false;
        }
      };

      // 保存账号
      var saveBtn = $('modalSave');
      if (saveBtn) saveBtn.onclick = async function () {
        var id = $('accId').value;
        var data = {
          nickname: $('accNickname').value.trim(),
          platform: $('accPlatform').value,
          game_username: $('accUsername').value.trim(),
          game_password: $('accPassword').value.trim(),
          server_id: $('accServer').value,
        };
        if (!data.game_username || !data.game_password) {
          showToast('请填写游戏账号和密码', 'error');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        showOverlay(true);

        try {
          var resp;
          if (id) {
            resp = await window.API.put('/api/sub-user/' + id, data);
          } else {
            resp = await window.API.post('/api/sub-user/', data);
          }
          if (resp.code === 200) {
            showToast(id ? '更新成功' : '创建成功', 'success');
            $('accountModal').style.display = 'none';
            loadAccounts();
          } else {
            showToast('保存失败: ' + (resp.msg || '未知错误'), 'error');
          }
        } catch (e) {
          showToast('网络错误: ' + e.message, 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
          showOverlay(false);
        }
      };

      // ==================== 顶部 ====================
      var headerEl = $('headerUser');
      if (headerEl && user) {
        headerEl.textContent = '👤 ' + user.username + (user.role === 'admin' ? ' (管理员)' : '');
      }
      if (user && user.role === 'admin') {
        var adminBtn = $('adminBtn');
        if (adminBtn) { adminBtn.style.display = ''; adminBtn.onclick = function () { location.href = '/admin.html'; }; }
      }

      var logoutBtn = $('logoutBtn');
      if (logoutBtn) logoutBtn.onclick = function () {
        window.API.clearToken();
        window.API.clearUser();
        window.location.href = '/login.html';
      };

      // ==================== Toast ====================
      function showToast(msg, type) {
        var container = $('toast-container');
        if (!container) return;
        var el = document.createElement('div');
        el.className = 'toast toast-' + (type || 'info');
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(function () { el.remove(); }, 3000);
      }

      function showOverlay(show) {
        var el = $('overlay');
        if (el) el.style.display = show ? 'flex' : 'none';
      }

      // ==================== 启动 ====================
      console.log('[dashboard] 开始加载账号列表');
      loadAccounts();

    } catch (e) {
      console.error('[dashboard] 初始化错误:', e);
      alert('控制台初始化失败: ' + e.message + '\n请硬刷新页面 (Ctrl+Shift+R)');
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
