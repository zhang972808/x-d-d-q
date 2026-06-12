/**
 * API 帮助函数 — JWT 认证
 */
window.API = {
  base: '',

  getToken() {
    return localStorage.getItem('xddq_token');
  },

  setToken(token) {
    localStorage.setItem('xddq_token', token);
  },

  clearToken() {
    localStorage.removeItem('xddq_token');
  },

  getUser() {
    try {
      const u = localStorage.getItem('xddq_user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  },

  setUser(user) {
    localStorage.setItem('xddq_user', JSON.stringify(user));
  },

  clearUser() {
    localStorage.removeItem('xddq_user');
  },

  get isLoggedIn() {
    return !!this.getToken();
  },

  async request(method, url, data = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (data && method !== 'GET') opts.body = JSON.stringify(data);

    let fullUrl = url.startsWith('http') ? url : this.base + url;
    if (data && method === 'GET') {
      const params = new URLSearchParams(data).toString();
      fullUrl += '?' + params;
    }

    const resp = await fetch(fullUrl, opts);
    const json = await resp.json();
    return json;
  },

  get(url, params) { return this.request('GET', url, params); },
  post(url, data) { return this.request('POST', url, data); },
  put(url, data) { return this.request('PUT', url, data); },
  del(url, data) { return this.request('DELETE', url, data); },
};
