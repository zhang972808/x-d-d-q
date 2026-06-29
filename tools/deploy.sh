#!/bin/bash
# ============================================
# 新服务器一键部署脚本
# 用法：
#   1. 先在本地打包: tar -czf xddq.tar.gz --exclude=node_modules --exclude=.git -C /opt .
#   2. scp xddq.tar.gz deploy.sh root@新服务器IP:/opt/
#   3. ssh root@新服务器IP "cd /opt && bash deploy.sh"
# ============================================
set -e

cd /opt

echo "=== 1. 解压项目 ==="
if [ -f xddq.tar.gz ]; then
    tar -xzf xddq.tar.gz
    rm -f xddq.tar.gz
fi

echo "=== 2. 检查 Node.js ==="
if ! command -v node &>/dev/null; then
    echo "安装 nvm 和 Node.js 18..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 18
    nvm use 18
fi
echo "Node.js $(node -v)"

echo "=== 3. 检查 PM2 ==="
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi

echo "=== 4. 设置时区 ==="
timedatectl set-timezone Asia/Shanghai 2>/dev/null || true

echo "=== 5. 安装依赖 ==="
npm install --production

echo "=== 6. 确保 data 目录存在 ==="
mkdir -p /opt/data

echo "=== 7. 配置环境变量 ==="
if [ ! -f /opt/.env ]; then
    cat > /opt/.env << 'ENVEOF'
DEEPSEEK_API_KEY=你的DeepSeek API Key
ENVEOF
    echo "⚠ 请编辑 /opt/.env 填入真实的 DEEPSEEK_API_KEY"
fi

echo "=== 8. 启动服务 ==="
pm2 delete xddq-server 2>/dev/null || true
pm2 start /opt/server.js --name xddq-server
pm2 save

echo "=== 9. 设置开机自启 ==="
pm2 startup 2>/dev/null || true

echo ""
echo "========================================"
echo "  部署完成！"
echo "  Web 管理界面: http://$(hostname -I | awk '{print $1}'):8080"
echo "  默认账号: admin / admin123"
echo ""
echo "  常用命令:"
echo "    pm2 list        — 查看运行状态"
echo "    pm2 logs        — 查看日志"
echo "    pm2 restart all — 重启所有"
echo "========================================"
