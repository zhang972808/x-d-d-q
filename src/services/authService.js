import axios from 'axios';
import CryptoJS from "crypto-js";
import qs from "qs";
import { v4 as uuidv4 } from "uuid";
import logger from "#utils/logger.js";
import fs from 'fs';
import util from 'util';

/**
 * 更新 account.js 文件
 * @param {*} filePath 
 * @param {*} newObject 
 * @returns 
 */
export async function updateAccount(filePath, newObject) {
    const readFileAsync = util.promisify(fs.readFile);
    const writeFileAsync = util.promisify(fs.writeFile);
    try {
        const data = await readFileAsync(filePath, 'utf8');
        let account;

        try {
            account = JSON.parse(data);
        } catch (parseErr) {
            logger.error('account.json JSON解析错误:', parseErr);
            return;
        }

        Object.assign(account, newObject);

        const newContent = JSON.stringify(account, null, 4);

        try {
            await writeFileAsync(filePath, newContent, 'utf8');
            logger.info('account.json 文件已成功修改并保存');
        } catch (writeErr) {
            logger.error('account.json 写入文件时出错:', writeErr);
        }
    } catch (err) {
        logger.error('account.json 读取文件时出错:', err);
    }
}

export default class AuthService {
    getRandomNum(count) {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let result = "";
        for (let i = 0; i < count; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    encryptPwd(pwd) {
        if (!pwd) {
            return null;
        }
        const str = this.getRandomNum(8) + pwd.substring(0, 3) + this.getRandomNum(5) + pwd.substring(3) + this.getRandomNum(2);
        return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str)).trim();
    }

    createRequestBody(token, uid, uname, encode = false, gxid = null) {
        const dataObj = {
            appID: "223",
            gameId: "24147",
            pid: "37h5",
            clientId: uuidv4(),
            oaid: global.account?.oaid || "",
            sqGameId: "913",
            token: token,
            uid: uid,
            uname: uname,
            time: Math.floor(Date.now() / 1000).toString(),
            c_game_id: "24147",
        };
        if (gxid) dataObj.gxid = gxid;

        const jsonStr = JSON.stringify(dataObj);
        return encode ? encodeURIComponent(jsonStr) : jsonStr;
    }

    async firstRequest(username, password) {
        const data = qs.stringify({
            'login_account': username,
            'password': this.encryptPwd(password)
        });

        const config = {
            method: 'post',
            url: 'https://mysdk.37.com/index.php?c=api-login&a=act_login',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async secondRequest(username, ptoken) {
        const data = qs.stringify({
            'is_self': '1',
            'pid': '37h5',
            'ptoken': ptoken,
            'puid': username
        });

        const config = {
            method: 'post',
            url: 'https://apimyh5.37.com/index.php?c=sdk-login&a=act_login',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async thirdRequest(serverId, token, uid, username, gxid = null) {
        const requestBody = this.createRequestBody(token, uid, username, true, gxid);

        const data = JSON.stringify({
            "data": requestBody,
            "loginType": 0,
            "deviceplate": "Android",
            "deviceId": global.account?.deviceId || "25098PN5AC-F6E86379FFA9E00ABFB9D5A302B0629FD41637EF",
            "channelId": 31,
            "appid": "37h5",
            "gameId": 223,
            "urlType": "mainLandAppUrl",
            "packageId": global.account?.packageId || "31003001",
            "c_game_id": "24147"
        });

        const url = `https://proxy-xddq-cn.ap3615.com/s${serverId}_http/player/login`;
        logger.info(`[Third] 请求URL: ${url}`);
        logger.info(`[Third] 请求体: ${data}`);

        const config = {
            method: 'post',
            url: url,
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        };

        try {
            const response = await axios(config);
            logger.info(`[Third] API返回: status=${response.status}, data=${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error) {
            logger.error(`[Third] 请求失败: ${error.message}, response=${JSON.stringify(error.response?.data)}`);
            throw error;
        }
    }

    async Bind(username, password) {
        try {
            const response = await this.firstRequest(username, password);
            const firstResponse = response.data;
            logger.info(`[Bind] API返回: code=${response.code}, msg=${response.msg}, full=${JSON.stringify(response)}`);
            if (response.code === 1) {
                return firstResponse;
            } else {
                throw new Error(`登陆失败: ${response.msg || response.code}`);
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async List(username, password) {
        try {
            const firstResponse = await this.Bind(username, password);
            const uid = firstResponse.userinfo.uid;
            const url = "https://login-xddq-cn.ap3615.com/server/list";
            const headers = {
                "content-type": "application/json",
            };

            const body = {
                "openId": uid,
                "channelId": 31,
            };

            const response = await axios.post(url, body, { headers });
            const { serverList, playerServerList } = response.data;
            logger.info(`[List] 完整响应: ${JSON.stringify(response.data).substring(0, 2000)}`);
            logger.info(`[List] 步月山相关服务器: ${JSON.stringify(serverList.filter(s => s.serverName.includes('步月山')))}`);

            if (!playerServerList || playerServerList.length === 0) {
                throw new Error("无活跃服务器");
            }

            const servers = serverList.filter(server => playerServerList.includes(server.serverId))
                .sort((a, b) => a.serverId - b.serverId)
                .map((server, index) => ({
                    id: index,
                    serverId: server.serverId,
                    serverName: server.serverName
                }));

            return { servers };
        } catch (e) {
            logger.error("无法获取服务器列表");
            throw e;
        }
    }

    async Login(username, password, serverId) {
        try {
            logger.info(`正在连接服务器...`);
            const firstResponse = await this.Bind(username, password);
            const ptoken = firstResponse.app_pst;
            const uid = firstResponse.userinfo.uid;
            const gxid = firstResponse.gxid || null;

            const secondResponse = await this.secondRequest(username, ptoken);
            logger.info(`[Second] API返回: code=${secondResponse.code}, msg=${secondResponse.msg}, full=${JSON.stringify(secondResponse)}`);
            if (secondResponse.code === 1) {
                const app_pst = secondResponse.data.app_pst;
                // 使用37平台返回的login_account作为uname，而非原始用户名
                const loginAccount = secondResponse.data.userinfo?.login_account || username;
                logger.info(`[Login] uname使用: ${loginAccount} (原始: ${username})`);

                const thirdResponse = await this.LoginWithToken(serverId, app_pst, uid, loginAccount, password, gxid);
                return thirdResponse;
            } else {
                throw new Error(`第二步登陆失败: ${secondResponse.msg || secondResponse.code}`);
            }
        } catch (error) {
            throw new Error(error.message || "登陆失败");
        }
    }

    async LoginWithToken(serverId, app_pst, uid, username, password, gxid = null) {
        try {
            const thirdResponse = await this.thirdRequest(serverId, app_pst, uid, username, gxid);

            if (thirdResponse.ret !== 0) {
                throw new Error(`游戏服务器拒绝登录 (ret=${thirdResponse.ret})。可能原因：1) API已更新需抓包 2) 服务器维护 3) 账号异常`);
            }
            logger.info(`登录成功, ${JSON.stringify(thirdResponse, null, "\t")}`);
            // 更新账户信息 保存token uid
            const filePath = global.configFile;

            const newObject = {
                "token": app_pst,
                "uid": uid,
                "nickName": thirdResponse.nickName,
            };
            await updateAccount(filePath, newObject);

            return thirdResponse;
        } catch (error) {
            throw new Error(error.message || "登陆失败");
        }
    }
}
