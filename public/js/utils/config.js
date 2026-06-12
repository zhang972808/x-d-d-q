// 配置管理模块
export default class Config {
    static baseUrl = window.location.host;
    static maxLogItems = 50;
    static reconnectInterval = 3000 * 10;
    static maxReconnectAttempts = 5;

    // 获取配置
    static getConfig() {
        return {
            baseUrl: this.baseUrl,
            maxLogItems: this.maxLogItems,
            reconnectInterval: this.reconnectInterval,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }

    // 更新配置
    static updateConfig(newConfig) {
        Object.assign(this, newConfig);
    }
}