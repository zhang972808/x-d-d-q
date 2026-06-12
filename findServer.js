import AuthService from "#services/authService.js";

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
    console.log('用法: node findServer.js <用户名> <密码>');
    process.exit(1);
}

const auth = new AuthService();
const result = await auth.List(username, password);

console.log('\n===== 你的服务器列表 =====\n');
result.servers.forEach(s => {
    const mark = s.serverName.includes('步月山') ? '  <-- 匹配!' : '';
    console.log(`  serverId: ${s.serverId}  \t名称: ${s.serverName}${mark}`);
});

const match = result.servers.filter(s => s.serverName.includes('步月山'));
if (match.length > 0) {
    console.log('\n找到匹配的服务器，请将以下内容填入 account.json:');
    console.log(`  "serverId": "${match[0].serverId}"`);
} else {
    console.log('\n未找到目标服务器，请在上面的列表中手动查找对应的 serverId');
}
