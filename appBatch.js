import fs from "fs";
import path from "path";
import { exec } from "child_process";
import logger from "#utils/logger.js";
import createPath from '#utils/path.js';

const resolvePath = createPath(import.meta.url);
const dataDir = resolvePath("./data");

fs.readdir(dataDir, (err, files) => {
    if (err) {
        logger.error("读取data目录失败:", err);
        return;
    }

    // 过滤出json文件
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    if (jsonFiles.length === 0) {
        logger.error("没有找到json配置文件");
        return;
    }

    const basePort = process.env.BASE_PORT || 8082;

    // 依次执行每个json配置文件
    jsonFiles.forEach((file, index) => {
        const filePath = path.join(dataDir, file);
        const port = parseInt(basePort) + index;

        // 读取 JSON 文件，获取 serverId 和 username
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                logger.error(`读取 ${filePath} 失败:`, err);
                return;
            }

            try {
                const account = JSON.parse(data);
                const { serverId, username } = account;

                if (!serverId || !username) {
                    logger.error(`配置文件 ${file} 中缺少 serverId 或 username`);
                    return;
                }

                const processName = `${serverId}_${username}`;
                logger.info(`启动进程: ${processName} 端口: ${port}`);

                const deleteCmd = `pm2 delete "${processName}"`;
                const startCmd = `pm2 start app.js --cron-restart "1 0 * * *" --name "${processName}" -- ${filePath} ${port}`;

                exec(deleteCmd, () => {
                  // 忽略删除错误（进程可能不存在）
                  exec(startCmd, (error, stdout, stderr) => {
                    if (error) {
                      logger.error(`执行 ${file} 失败:`, error);
                      return;
                    }
                    logger.info(`执行 ${file} 成功: ${stdout}`);
                    if (stderr) {
                      logger.error(stderr);
                    }
                  });
                });
            } catch (parseError) {
                logger.error(`解析 ${filePath} 失败:`, parseError);
            }
        });
    });
});
