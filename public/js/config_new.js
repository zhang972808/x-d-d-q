/**
 * 配置页面 v5 — 8个tab全覆盖
 */
(function () {
  'use strict';

  if (!window.API || !window.API.isLoggedIn) { window.location.href = '/login.html'; return; }

  var params = new URLSearchParams(window.location.search);
  var accountId = params.get('accountId');
  if (!accountId) { document.body.innerHTML = '<div class="container"><h2>缺少账号ID</h2><p>请从控制台打开</p></div>'; return; }

  var configUrl = '/api/sub-user/' + accountId + '/setting';

  function $(id) { return document.getElementById(id); }
  function toast(msg, type) {
    var c = $('toast-container'); if (!c) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }
  function overlay(s) { var el = $('overlay'); if (el) el.style.display = s ? 'flex' : 'none'; }

  // ==================== 灵兽标签选择（全局定义，前后都要用） ====================
  var ALL_PETS = [
    {id:114001,name:'应龙(神话)'},{id:114002,name:'年'},{id:114003,name:'无支祁'},
    {id:114004,name:'九尾狐'},{id:114005,name:'狻猊'},{id:114006,name:'计蒙'},
    {id:114007,name:'鸾鸟(神话)'},{id:115001,name:'青龙(神兽)'},{id:115002,name:'白虎(神兽)'},
    {id:115003,name:'朱雀(神兽)'},{id:115004,name:'玄武(神兽)'},{id:115005,name:'麒麟(神兽)'},
    {id:115006,name:'蚩尤'},{id:115007,name:'天苍巨蟒'},{id:115008,name:'相柳'},
    {id:115009,name:'噬金虫'},{id:115010,name:'土甲龙'},{id:115011,name:'三足金乌'},
    {id:115012,name:'蜚牛'},{id:115013,name:'钦原'},{id:115014,name:'虎蛟'},
    {id:115015,name:'花狐貂'},{id:115016,name:'哮天'},{id:115017,name:'金眼神莺'},
    {id:115018,name:'陆吾'},{id:115019,name:'犰狳'}
  ];

  var selectedPets = [];

  function renderPetTags() {
    var group = $('petTagGroup');
    if (!group) return;
    var html = '';
    ALL_PETS.forEach(function(p) {
      var sel = selectedPets.indexOf(p.id) >= 0;
      html += '<span class="tag-item' + (sel ? ' selected' : '') + '" data-petid="' + p.id + '">' + p.name + '</span>';
    });
    group.innerHTML = html;
    group.querySelectorAll('.tag-item').forEach(function(tag) {
      tag.onclick = function() {
        var pid = parseInt(tag.dataset.petid);
        var idx = selectedPets.indexOf(pid);
        if (idx >= 0) { selectedPets.splice(idx, 1); }
        else { selectedPets.push(pid); }
        renderPetTags();
        updatePetHint();
      };
    });
    updatePetHint();
  }

  function updatePetHint() {
    var el = $('petSelectedHint');
    if (!el) return;
    if (selectedPets.length === 0) { el.textContent = '无'; return; }
    var names = selectedPets.map(function(id) {
      var p = ALL_PETS.find(function(x) { return x.id === id; });
      return p ? p.name : id;
    });
    el.textContent = names.join('、');
  }

  // ==================== 字段定义 ====================
  var fields = {
    basic: {
      nickName: { t: 'text', d: '' },
      loginToken: { t: 'text', d: '' },
      maxRetries: { t: 'text', d: '10' },
      reconnectInterval: { t: 'number', d: 300000 },
      startupDelay: { t: 'number', d: 5000 },
    },
    homeMisc: {
      ignoreTimeCheck: { t: 'checkbox', d: false },
    },
    union: {
      unionBargainNum: { t: 'number', d: 0 },
      unionBargainPrice: { t: 'number', d: 0 },
    },
    switch: {
      homeland: { t: 'checkbox', d: false },
      homelandGetReward: { t: 'checkbox', d: false },
      chopTree: { t: 'checkbox', d: false },
      talent: { t: 'checkbox', d: false },
      herorank: { t: 'checkbox', d: false },
      herorankFightDaily: { t: 'checkbox', d: false },
      challenge: { t: 'number', d: 0 },
      invade: { t: 'checkbox', d: false },
      invadeIndex: { t: 'number', d: 0 },
      starTrial: { t: 'checkbox', d: false },
      pupil: { t: 'checkbox', d: false },
      ticket: { t: 'number', d: 1 },
      defaultIndex: { t: 'number', d: 0 },
      challengeIndex: { t: 'number', d: 0 },
      activity: { t: 'checkbox', d: false },
      wildBoss: { t: 'checkbox', d: false },
      gatherEnergy: { t: 'checkbox', d: false },
      holyLand: { t: 'checkbox', d: false },
      townDemon: { t: 'checkbox', d: false },
      career: { t: 'checkbox', d: false },
      skywar: { t: 'checkbox', d: false },
      skywarIndex: { t: 'number', d: 0 },
      challengeSuccessReset: { t: 'checkbox', d: false },
      challengeWindowStart: { t: 'number', d: 6 },
      challengeWindowEnd: { t: 'number', d: 8 },
    },
    chopTreeStop: {
      num: { t: 'number', d: 40000 },
      doNum: { t: 'text', d: 'infinity' },
      level: { t: 'text', d: 'infinity' },
    },
    chopTree: {
      showResult: { t: 'checkbox', d: false },
      chopMode: { t: 'text', d: 'strict' },
    },
    chopTreeSep: {
      fightValueFirst: { t: 'checkbox', d: false },
      quality: { t: 'number', d: 1 },
      levelOffset: { t: 'number', d: 5 },
      probOffsetLowLv: { t: 'number', d: 0.3 },
      probOffset: { t: 'number', d: 0.2 },
      strictMode: { t: 'checkbox', d: false },
    },
    talent: {
      showResult: { t: 'checkbox', d: false },
    },
    talentSep: {
      quality: { t: 'number', d: 5 },
    },
    holyLand: {
      maxJadeCost: { t: 'number', d: 0 },
    },
  };

  // 字段前缀映射
  var prefixes = {
    basic: '', homeMisc: '', union: '',
    switch: 'switch_', chopTreeStop: 'chopTree_stop_', chopTree: 'chopTree_',
    chopTreeSep: 'chopTree_separation_',
    talent: 'talent_', talentSep: 'talent_separation_',
    holyLand: 'holyLand_',
  };

  // ==================== 从表单提取配置 ====================
  function getConfig() {
    var config = {};

    // 基本字段
    readFields(config, 'basic');
    // 福地杂项
    config.homeland = {};
    readFields(config.homeland, 'homeMisc');
    // 妖盟
    readFields(config, 'union');
    // 商店购买列表
    config.buyUnionGoodLists = [];
    var cbs = document.querySelectorAll('#buyUnionGoodLists input:checked');
    cbs.forEach(function (cb) { config.buyUnionGoodLists.push(parseInt(cb.value)); });

    // 福地规则
    config.rules = getRules('rulesContainer');
    config.rulesWeak = getRules('rulesWeakContainer');
    config.rulesStrong = getRules('rulesStrongContainer');

    // 开关
    config.switch = {};
    readFields(config.switch, 'switch');

    // 砍树
    config.chopTree = { stop: {}, separation: {} };
    readFields(config.chopTree.stop, 'chopTreeStop');
    readFields(config.chopTree.separation, 'chopTreeSep');
    readFields(config.chopTree, 'chopTree');
    config.chopTree.separation.condition = [];
    for (var i = 0; i < 3; i++) {
      var row = [];
      for (var j = 0; j < 2; j++) {
        var el = $('chopTree_separation_condition_' + i + '_' + j);
        if (el) row.push(parseInt(el.value) || 0);
      }
      if (row.length === 2) config.chopTree.separation.condition.push(row);
    }
    if (config.chopTree.separation.strictMode) {
      config.chopTree.separation.strictConditions = config.chopTree.separation.condition.map(function (pair) {
        return { primaryAttribute: [pair[0]], secondaryAttribute: [pair[1]] };
      });
    }

    // 灵脉
    config.talent = { separation: {} };
    readFields(config.talent.separation, 'talentSep');
    readFields(config.talent, 'talent');

    // 九幽争霸
    config.holyLand = {};
    readFields(config.holyLand, 'holyLand');

    // 灵兽
    config.wishPetPool = selectedPets.slice();

    return config;
  }

  function readFields(target, name) {
    var prefix = prefixes[name] || '';
    var map = fields[name];
    if (!map) return;
    Object.keys(map).forEach(function (key) {
      var el = $(prefix + key);
      if (!el) return;
      var f = map[key];
      switch (f.t) {
        case 'checkbox': target[key] = el.checked; break;
        case 'number': var n = parseInt(el.value); target[key] = isNaN(n) ? f.d : n; break;
        default: target[key] = el.value !== undefined ? el.value : f.d; break;
      }
    });
  }

  function getRules(containerId) {
    var rules = [];
    var container = $(containerId);
    if (!container) return rules;
    var items = container.querySelectorAll('.rule-template');
    var seen = {};
    items.forEach(function (el) {
      var sel = el.querySelector('.item-select');
      if (!sel) return;
      var itemId = parseInt(sel.value);
      if (seen[itemId]) return;
      seen[itemId] = true;
      rules.push({
        ItemId: itemId,
        minItemLv: parseInt(el.querySelector('.min-level')?.value) || 1,
        isCheck: el.querySelector('.is-check')?.checked || false,
        description: sel.options[sel.selectedIndex]?.text || '',
      });
    });
    return rules;
  }

  // ==================== 填充表单 ====================
  function fillConfig(config) {
    if (!config) return;

    writeFields(config, 'basic');
    writeFields(config.homeland || {}, 'homeMisc');
    writeFields(config, 'union');

    // 商店列表
    var buyList = config.buyUnionGoodLists || [];
    document.querySelectorAll('#buyUnionGoodLists input[type="checkbox"]').forEach(function (cb) {
      cb.checked = buyList.indexOf(parseInt(cb.value)) >= 0;
    });

    // 福地规则
    fillRules('rulesContainer', config.rules || []);
    fillRules('rulesWeakContainer', config.rulesWeak || []);
    fillRules('rulesStrongContainer', config.rulesStrong || []);

    // 开关
    writeFields(config.switch || {}, 'switch');

    // 砍树
    var ch = config.chopTree || {};
    writeFields(ch.stop || {}, 'chopTreeStop');
    writeFields(ch.separation || {}, 'chopTreeSep');
    writeFields(ch, 'chopTree');
    if (ch.separation && ch.separation.condition) {
      ch.separation.condition.forEach(function (row, i) {
        row.forEach(function (val, j) {
          var el = $('chopTree_separation_condition_' + i + '_' + j);
          if (el) el.value = val;
        });
      });
    }

    // 灵脉
    var t = config.talent || {};
    writeFields(t.separation || {}, 'talentSep');
    writeFields(t, 'talent');

    // 九幽争霸
    writeFields(config.holyLand || {}, 'holyLand');

    // 灵兽
    var pets = config.wishPetPool || [];
    selectedPets = Array.isArray(pets) ? pets.slice() : [];
    if (typeof pets === 'string') {
      selectedPets = pets.split(',').map(Number).filter(Boolean);
    }
    renderPetTags();
  }

  function writeFields(source, name) {
    var prefix = prefixes[name] || '';
    var map = fields[name];
    if (!map) return;
    Object.keys(map).forEach(function (key) {
      var el = $(prefix + key);
      if (!el) return;
      var f = map[key];
      var val = source ? source[key] : undefined;
      switch (f.t) {
        case 'checkbox': el.checked = !!val; break;
        default: el.value = val !== undefined ? val : f.d; break;
      }
    });
  }

  function fillRules(containerId, rules) {
    var container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    var frag = document.createDocumentFragment();
    var seen = {};
    rules.forEach(function (rule) {
      if (seen[rule.ItemId]) return;
      seen[rule.ItemId] = true;
      var clone = makeRuleElement();
      clone.querySelector('.item-select').value = rule.ItemId;
      clone.querySelector('.min-level').value = rule.minItemLv;
      clone.querySelector('.is-check').checked = rule.isCheck;
      frag.appendChild(clone);
    });
    container.appendChild(frag);
  }

  function makeRuleElement() {
    var tpl = document.getElementById('ruleTemplate');
    if (!tpl) {
      var div = document.createElement('div');
      div.className = 'rule-template';
      div.innerHTML = '<div class="rule-content"><div class="form-group"><label>物品</label><select class="item-select">' +
        '<option value="100004">仙桃</option><option value="100025">净瓶水</option><option value="100029">琉璃珠</option>' +
        '<option value="100044">天衍令</option><option value="100047">昆仑铁</option><option value="100003">灵石</option>' +
        '<option value="100000">仙玉</option></select></div><div class="form-group"><label>最低品质</label>' +
        '<input type="number" class="min-level" min="1" max="9" value="3"/></div><div class="form-group">' +
        '<label><input type="checkbox" class="is-check"/>启用检查</label></div></div>' +
        '<button class="delete-rule-btn" title="删除">×</button>';
      return div;
    }
    return tpl.content.firstElementChild.cloneNode(true);
  }

  // ==================== 灵兽按钮 ====================
  var petClearEl = $('petClearAll');
  if (petClearEl) petClearEl.onclick = function () { selectedPets = []; renderPetTags(); };
  var petCommonEl = $('petSelectCommon');
  if (petCommonEl) petCommonEl.onclick = function () {
    selectedPets = [114001, 114007, 115001, 115002, 115003, 115004, 115005];
    renderPetTags();
  };

  // ==================== 保存与加载 ====================
  async function loadConfig() {
    try {
      overlay(true);
      var resp = await window.API.get(configUrl);
      if (resp.code === 200) {
        fillConfig(resp.data || {});
        toast('配置加载成功', 'success');
      } else {
        toast('加载失败: ' + resp.msg, 'error');
      }
    } catch (e) {
      toast('加载失败: ' + e.message, 'error');
    } finally {
      overlay(false);
    }
  }

  async function saveConfig() {
    try {
      overlay(true);
      var config = getConfig();
      var resp = await window.API.put(configUrl, config);
      if (resp.code === 200) {
        toast('💾 配置保存成功', 'success');
      } else {
        toast('保存失败: ' + resp.msg, 'error');
      }
    } catch (e) {
      toast('保存失败: ' + e.message, 'error');
    } finally {
      overlay(false);
    }
  }

  // ==================== 事件 ====================
  // Tab 切换
  var tabBar = $('tabBar');
  if (tabBar) {
    tabBar.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      tabBar.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var tabId = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
      // 映射 tab id → content id
      var contentMap = {
        general: 'generalTab', homeland: 'homelandTab', switches: 'switchesTab',
        choptree: 'chopTreeTab', talent: 'talentTab',
        holyLand: 'holyLandTab', pet: 'petTab'
      };
      var content = document.getElementById(contentMap[tabId] || (tabId + 'Tab'));
      if (content) content.classList.add('active');
    });
  }

  // 添加/删除规则
  document.addEventListener('click', function (e) {
    var addBtn = e.target.closest('.add-rule-btn');
    if (addBtn) {
      var containerId = addBtn.dataset.container;
      var container = document.getElementById(containerId);
      if (container) {
        container.appendChild(makeRuleElement());
      }
      return;
    }
    var delBtn = e.target.closest('.delete-rule-btn');
    if (delBtn) {
      var ruleEl = delBtn.closest('.rule-template');
      if (ruleEl) ruleEl.remove();
    }
  });

  // 保存
  var saveBtn = $('saveConfig');
  if (saveBtn) saveBtn.addEventListener('click', saveConfig);

  // 返回
  var backBtn = $('backBtn');
  if (backBtn) backBtn.addEventListener('click', function () {
    window.location.href = '/index.html';
  });

  // ==================== 启动 ====================
  document.addEventListener('DOMContentLoaded', loadConfig);
})();
