#!/bin/bash

# 心灵微光 AI助教工作台 - IP地址查看工具（Next.js 本地开发版）
# 用于快速查看当前局域网IP和访问地址（电脑 / 手机）

echo ""
echo "=========================================="
echo "🌐 当前网络信息"
echo "=========================================="

# 获取局域网IP（macOS / 大多数 Linux 可用）
LOCAL_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$LOCAL_IP" ]; then
  echo "❌ 未检测到局域网IP"
  echo "请检查网络连接（是否连接了 Wi-Fi / 有线网络）"
else
  echo "📍 局域网IP: $LOCAL_IP"
  echo ""
  echo "=========================================="
  echo "🚀 访问地址（本项目）"
  echo "=========================================="
  echo ""
  echo "🖥️  电脑访问（日常开发）："
  echo "    http://localhost:3000"
  echo ""
  echo "📱 局域网访问（手机扫码测试）："
  echo "    http://$LOCAL_IP:3000"
  echo ""
  echo "（说明：二维码里会使用你在浏览器中打开的地址；"
  echo "  若用 192.168.x.x:3000 打开课程页面，手机扫码即可访问。）"
  echo ""
fi

# 查看主机名（用于 .local 访问的备选方案）
HOSTNAME=$(hostname | sed 's/.local//')
echo "🖥️  主机名访问（备选）："
echo "    http://$HOSTNAME.local:3000"
echo ""
echo "=========================================="
echo "💡 提示"
echo "=========================================="
echo "• 平时开发用 http://localhost:3000 即可；"
echo "• 测试手机扫码时，在浏览器中用 http://局域网IP:3000 打开课程页面；"
echo "• IP 有时会变化（重启路由器等），需要时重新运行此脚本查看；"
echo ""

