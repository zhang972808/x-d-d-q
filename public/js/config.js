// 配置界面功能
import { api, toast, session, overlay } from "./common.js";

// 缓存DOM元素
const DOM = {
  configForm: document.getElementById("configForm"),
  buyUnionGoodLists: document.getElementById("buyUnionGoodLists"),
  rulesContainer: document.getElementById("rulesContainer"),
  rulesWeakContainer: document.getElementById("rulesWeakContainer"),
  rulesStrongContainer: document.getElementById("rulesStrongContainer"),
  saveBtn: document.querySelector(".save-btn"),
  backBtn: document.querySelector(".back-btn"),
  tabs: document.querySelector(".tabs"),
};

// 配置管理
const configManager = {
  // 配置字段映射
  fieldMap: {
    basic: {
      nickName: { type: "text", default: "" },
      loginToken: { type: "text", default: "" },
      maxRetries: { type: "text", default: "10" },
      reconnectInterval: { type: "number", default: 300000 },
      startupDelay: { type: "number", default: 5000 },
    },
    homeland: {
      ignoreTimeCheck: { type: "checkbox", default: false },
    },
    union: {
      unionBargainNum: { type: "number", default: 0 },
      unionBargainPrice: { type: "number", default: 0 },
    },
    switch: {
      homeland: { type: "checkbox", default: false },
      homelandGetReward: { type: "checkbox", default: false },
      chopTree: { type: "checkbox", default: false },
      talent: { type: "checkbox", default: false },
      herorank: { type: "checkbox", default: false },
      herorankFightDaily: { type: "checkbox", default: false },
      challenge: { type: "number", default: 0 },
      invade: { type: "checkbox", default: false },
      invadeIndex: { type: "number", default: 0 },
      starTrial: { type: "checkbox", default: false },
      pupil: { type: "checkbox", default: false },
      ticket: { type: "number", default: 0 },
      defaultIndex: { type: "number", default: 0 },
      challengeIndex: { type: "number", default: 0 },
      activity: { type: "checkbox", default: false },
      wildBoss: { type: "checkbox", default: false },
      gatherEnergy: { type: "checkbox", default: false },
      syncMode: { type: "checkbox", default: false },
      holyLand: { type: "checkbox", default: false },
      townDemon: { type: "checkbox", default: false },
      tribulation: { type: "checkbox", default: false },
      career: { type: "checkbox", default: false },
    },
    tribulation: {
      minProbability: { type: "number", default: 75 },
      checkHour: { type: "number", default: 10 },
    },
    chopTree: {
      stop: {
        num: { type: "number", default: 40000 },
        doNum: { type: "text", default: "infinity" },
        level: { type: "text", default: "infinity" },
      },
      showResult: { type: "checkbox", default: false },
      separation: {
        fightValueFirst: { type: "checkbox", default: false },
        quality: { type: "number", default: 35 },
        levelOffset: { type: "number", default: 5 },
        probOffsetLowLv: { type: "number", default: 0.3 },
        probOffset: { type: "number", default: 0.2 },
        condition: {
          type: "array",
          default: [
            [6, 12],
            [6, 11],
            [8, 12],
          ],
        },
        strictMode: { type: "checkbox", default: false },
        strictConditions: { type: "array", default: [] },
      },
    },
    talent: {
      stop: {
        stopNum: { type: "number", default: 1 },
        doNum: { type: "text", default: "infinity" },
      },
      showResult: { type: "checkbox", default: false },
      separation: {
        quality: { type: "number", default: 5 },
      },
    },
  },

  // 加载配置
  async loadConfig() {
    try {
      overlay.show();
      const config = await api.getConfig();
      await this.fillConfigForm(config);
      toast.success("✨ 配置加载成功");
    } catch (error) {
      toast.error(`❌ 配置加载失败: ${error.message}`);
    } finally {
      overlay.hide();
    }
  },

  // 保存配置
  async saveConfig() {
    try {
      overlay.show();
      const config = this.getConfigFromForm();
      await api.saveConfig(config);
      toast.success("💾 配置保存成功");
    } catch (error) {
      toast.error(`❌ 配置保存失败: ${error.message}`);
    } finally {
      overlay.hide();
    }
  },

  // 返回主页
  backIndex() {
    window.location.href = "/loader/index.html";
  },

  // 从表单获取配置
  getConfigFromForm() {
    const config = {};

    // 处理基本字段
    this.processFields(config, this.fieldMap.basic);

    // 处理homeland字段
    config.homeland = {};
    this.processFields(config.homeland, this.fieldMap.homeland);

    // 处理union字段
    this.processFields(config, this.fieldMap.union);

    // 处理商品购买列表
    config.buyUnionGoodLists = Array.from(
      document.querySelectorAll("#buyUnionGoodLists input:checked")
    ).map((input) => parseInt(input.value));

    // 处理规则
    config.rules = this.getRules("rulesContainer");
    config.rulesWeak = this.getRules("rulesWeakContainer");
    config.rulesStrong = this.getRules("rulesStrongContainer");

    // 处理功能开关
    config.switch = {};
    this.processFields(config.switch, this.fieldMap.switch, "switch_");

    // 处理砍树设置
    config.chopTree = {
      stop: {},
      separation: {},
    };
    this.processFields(
      config.chopTree.stop,
      this.fieldMap.chopTree.stop,
      "chopTree_stop_"
    );
    this.processFields(config.chopTree, this.fieldMap.chopTree, "chopTree_", [
      "stop",
    ]);
    this.processFields(
      config.chopTree.separation,
      this.fieldMap.chopTree.separation,
      "chopTree_separation_",
      ["condition"]
    );

    // 处理condition数组
    config.chopTree.separation.condition = [];
    for (let i = 0; i < 3; i++) {
      const condition = [];
      for (let j = 0; j < 2; j++) {
        const element = document.getElementById(
          `chopTree_separation_condition_${i}_${j}`
        );
        if (element) {
          condition.push(parseInt(element.value) || 0);
        }
      }
      if (condition.length === 2) {
        config.chopTree.separation.condition.push(condition);
      }
    }

    // 处理严格模式条件
    if (config.chopTree.separation.strictMode) {
      config.chopTree.separation.strictConditions =
        config.chopTree.separation.condition.map(([primary, secondary]) => ({
          primaryAttribute: [primary],
          secondaryAttribute: [secondary],
        }));
    }

    // 处理灵脉设置
    config.talent = {
      stop: {},
      separation: {},
    };
    this.processFields(
      config.talent.stop,
      this.fieldMap.talent.stop,
      "talent_stop_"
    );
    this.processFields(config.talent, this.fieldMap.talent, "talent_", [
      "stop",
    ]);
    this.processFields(
      config.talent.separation,
      this.fieldMap.talent.separation,
      "talent_separation_"
    );

    // 处理渡劫设置
    config.tribulation = {};
    this.processFields(config.tribulation, this.fieldMap.tribulation, "tribulation_");

    return config;
  },

  // 处理字段
  processFields(target, fields, prefix = "", excludeKeys = []) {
    Object.entries(fields).forEach(([key, field]) => {
      if (excludeKeys.includes(key)) return;
      const element = document.getElementById(prefix + key);
      if (!element) return;

      switch (field.type) {
        case "checkbox":
          target[key] = element.checked;
          break;
        case "number": {
          const num = parseInt(element.value);
          target[key] = !isNaN(num) ? num : field.default;
          break;
        }
        case "text":
          target[key] = element.value ?? field.default;
          break;
      }
    });
  },

  // 获取规则配置
  getRules(containerId) {
    const rules = [];
    const container = document.getElementById(containerId);
    const ruleElements = container.querySelectorAll(".rule-template");
    const itemIdSet = new Set();

    ruleElements.forEach((element) => {
      const itemId = parseInt(element.querySelector(".item-select").value);
      if (itemIdSet.has(itemId)) {
        const itemSelect = element.querySelector(".item-select");
        const itemName = itemSelect.options[itemSelect.selectedIndex].text;
        toast.warning(`规则中存在重复的物品: ${itemName}，已自动跳过`);
        return;
      }
      itemIdSet.add(itemId);

      const itemSelect = element.querySelector(".item-select");
      const rule = {
        ItemId: itemId,
        minItemLv: parseInt(element.querySelector(".min-level").value) || 1,
        isCheck: element.querySelector(".is-check").checked,
        description: itemSelect.options[itemSelect.selectedIndex].text
      };
      rules.push(rule);
    });

    return rules;
  },

  // 填充配置表单
  fillConfigForm(config) {
    if (!config) return;

    // 处理基本字段
    this.fillFields(config, this.fieldMap.basic);

    // 处理homeland字段
    if (config.homeland) {
      this.fillFields(config.homeland, this.fieldMap.homeland);
    }

    // 处理union字段
    this.fillFields(config, this.fieldMap.union);

    // 处理商品购买列表
    const buyUnionGoodLists = config.buyUnionGoodLists || [];
    document
      .querySelectorAll('#buyUnionGoodLists input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.checked = buyUnionGoodLists.includes(parseInt(checkbox.value));
      });

    // 处理规则设置
    this.fillRules("rulesContainer", config.rules || []);
    this.fillRules("rulesWeakContainer", config.rulesWeak || []);
    this.fillRules("rulesStrongContainer", config.rulesStrong || []);

    // 处理功能开关
    if (config.switch) {
      this.fillFields(config.switch, this.fieldMap.switch, "switch_");
    }

    // 处理砍树设置
    if (config.chopTree) {
      const { stop = {}, separation = {} } = config.chopTree;
      this.fillFields(stop, this.fieldMap.chopTree.stop, "chopTree_stop_");
      this.fillFields(config.chopTree, this.fieldMap.chopTree, "chopTree_", [
        "stop",
      ]);

      // 特殊处理condition数组
      if (separation.condition) {
        separation.condition.forEach((condition, i) => {
          condition.forEach((value, j) => {
            const element = document.getElementById(
              `chopTree_separation_condition_${i}_${j}`
            );
            if (element) {
              element.value = value;
            }
          });
        });
      }

      this.fillFields(
        separation,
        this.fieldMap.chopTree.separation,
        "chopTree_separation_",
        ["condition"]
      );
    }

    // 处理灵脉设置
    if (config.talent) {
      const { stop = {}, separation = {} } = config.talent;
      this.fillFields(stop, this.fieldMap.talent.stop, "talent_stop_");
      this.fillFields(config.talent, this.fieldMap.talent, "talent_", ["stop"]);
      this.fillFields(
        separation,
        this.fieldMap.talent.separation,
        "talent_separation_"
      );
    }

    // 处理渡劫设置
    if (config.tribulation) {
      this.fillFields(config.tribulation, this.fieldMap.tribulation, "tribulation_");
    }
  },

  // 填充字段
  fillFields(source, fields, prefix = "", excludeKeys = []) {
    Object.entries(fields).forEach(([key, field]) => {
      if (excludeKeys.includes(key)) return;
      const element = document.getElementById(prefix + key);
      if (!element) return;

      const value = source[key];
      switch (field.type) {
        case "checkbox":
          element.checked = Boolean(value);
          break;
        case "number":
        case "text":
          element.value = value ?? field.default;
          break;
      }
    });
  },

  // 填充规则
  fillRules(containerId, rules) {
    const container = document.getElementById(containerId);
    const template = document.querySelector(".rule-template");

    if (!template) {
      toast.error("规则模板元素不存在");
      return;
    }

    // 清空容器
    container.innerHTML = "";

    // 用于检查重复项的Set
    const itemIdSet = new Set();

    // 批量创建规则元素
    const fragment = document.createDocumentFragment();
    rules.forEach((rule) => {
      // 检查重复项
      if (itemIdSet.has(rule.ItemId)) {
        toast.warning(`规则中存在重复的物品: ${rule.ItemId}`);
        return;
      }
      itemIdSet.add(rule.ItemId);
      const ruleElement = template.cloneNode(true);
      const itemSelect = ruleElement.querySelector(".item-select");
      const minLevel = ruleElement.querySelector(".min-level");
      const isCheck = ruleElement.querySelector(".is-check");

      if (itemSelect) {
        itemSelect.value = rule.ItemId;
        // 设置description字段
        rule.description = itemSelect.options[itemSelect.selectedIndex].text;
      }
      if (minLevel) minLevel.value = rule.minItemLv;
      if (isCheck) isCheck.checked = rule.isCheck;

      fragment.appendChild(ruleElement);
    });

    container.appendChild(fragment);
  },

  // 处理标签切换
  handleTabSwitch(tab) {
    if (!tab) return;

    const tabs = document.querySelectorAll(".tab");
    const contents = document.querySelectorAll(".tab-content");

    tabs.forEach((t) => t.classList.remove("active"));
    contents.forEach((c) => c.classList.remove("active"));

    tab.classList.add("active");

    const tabId = tab.dataset.tab;
    const contentId = tabId === "choptree" ? "chopTreeTab" : `${tabId}Tab`;
    document.getElementById(contentId)?.classList.add("active");
  },

  // 添加新规则
  addNewRule(container) {
    const template = document.querySelector(".rule-template");
    if (!template || !container) return;

    const newRule = template.cloneNode(true);
    const itemSelect = newRule.querySelector(".item-select");
    itemSelect.selectedIndex = 0;
    newRule.querySelector(".min-level").value = "1";
    newRule.querySelector(".is-check").checked = false;
    container.appendChild(newRule);
  },

  // 初始化事件
  initEvents() {
    // 标签切换事件
    DOM.tabs?.addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      this.handleTabSwitch(tab);
    });

    // 规则管理事件委托
    document.addEventListener("click", (e) => {
      const addBtn = e.target.closest(".add-rule-btn");
      if (addBtn) {
        this.addNewRule(addBtn.previousElementSibling);
        return;
      }

      const deleteBtn = e.target.closest(".delete-rule-btn");
      if (deleteBtn) {
        deleteBtn.closest(".rule-template")?.remove();
      }
    });

    // 保存和返回按钮事件
    DOM.saveBtn?.addEventListener("click", () => this.saveConfig());
    DOM.backBtn?.addEventListener("click", () => this.backIndex());
  },
};

// 初始化配置界面
document.addEventListener("DOMContentLoaded", () => {
  if (!session.checkLogin()) return;
  configManager.loadConfig();
  configManager.initEvents();
});

export default configManager;
