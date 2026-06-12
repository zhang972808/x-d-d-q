import fs from 'fs';
import util from 'util';
import logger from "#utils/logger.js";

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

/**
 * 获取配置文件内容
 * @param {string} filePath 配置文件路径
 * @returns {Promise<Object>} 配置对象
 */
export async function getConfig(filePath) {
  try {
    const data = await readFileAsync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`读取配置文件失败: ${error.message}`);
    throw error;
  }
}

/**
 * 保存配置文件内容
 * @param {string} filePath 配置文件路径
 * @param {Object} config 配置对象
 * @returns {Promise<void>}
 */
export function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export async function saveConfig(filePath, config) {
  try {
    const data = await readFileAsync(filePath, 'utf8');
    const currentConfig = JSON.parse(data);

    // 深度合并：新配置覆盖旧配置，旧配置中未提及的字段保留
    const merged = deepMerge(currentConfig, config);

    const newContent = JSON.stringify(merged, null, 4);
    await writeFileAsync(filePath, newContent, 'utf8');
    logger.info('配置文件已成功保存');
    return { success: true };
  } catch (error) {
    logger.error(`保存配置文件失败: ${error.message}`);
    throw error;
  }
}