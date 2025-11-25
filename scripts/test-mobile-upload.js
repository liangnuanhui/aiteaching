/**
 * 移动端上传页面调试工具
 * 在浏览器控制台运行（F12 → Console）
 */

console.log('=== 移动端上传页面稳定性测试 ===\n');

// 测试1: 检查WebSocket连接是否存在问题
console.log('测试1: 检查WebSocket状态');
const wsConnections = window.__NEXT_PING_WEBSOCKET__ || '无直接访问';
console.log('WebSocket状态:', wsConnections);

// 测试2: 监测页面刷新事件
let refreshCount = 0;
window.addEventListener('beforeunload', e => {
  refreshCount++;
  console.log(`检测到页面刷新/关闭 (#${refreshCount})`, {
    time: new Date().toLocaleTimeString(),
    reason: e.reason || '未知',
  });
});

// 测试3: 文件选择器变更监听
console.log('\n测试3: 设置文件选择监听');
const fileInputs = document.querySelectorAll('input[type="file"]');
console.log(`找到 ${fileInputs.length} 个文件输入框`);

fileInputs.forEach((input, index) => {
  console.log(`  输入框 ${index + 1}:`, {
    id: input.id || '无ID',
    class: input.className || '无class',
    accept: input.accept || '无限制',
  });

  // 监听变化
  input.addEventListener('change', e => {
    console.log(`\n[文件选择事件] 输入框 ${index + 1}:`, {
      filesCount: e.target.files.length,
      files: Array.from(e.target.files).map(f => ({
        name: f.name,
        size: (f.size / 1024 / 1024).toFixed(2) + ' MB',
        type: f.type,
      })),
      timestamp: new Date().toISOString(),
    });
  });
});

// 测试4: 网络请求监控
console.log('\n测试4: 设置网络请求监控');
const originalFetch = window.fetch;
window.fetch = function (...args) {
  console.log(`[Fetch] ${args[0]}`, {
    method: args[1]?.method || 'GET',
    timestamp: new Date().toLocaleTimeString(),
  });

  return originalFetch.apply(this, args);
};

// 测试5: 定时器
console.log('\n测试5: 检查页面定时器');
const timerTypes = {
  intervals: [],
  timeouts: [],
};

const originalSetInterval = window.setInterval;
const originalSetTimeout = window.setTimeout;

window.setInterval = function (...args) {
  const id = originalSetInterval.apply(this, args);
  timerTypes.intervals.push({ id, delay: args[1] });
  console.log(`[定时器] 创建 setInterval (ID: ${id}, 延迟: ${args[1]}ms)`);
  return id;
};

window.setTimeout = function (...args) {
  const id = originalSetTimeout.apply(this, args);
  timerTypes.timeouts.push({ id, delay: args[1] });
  console.log(`[定时器] 创建 setTimeout (ID: ${id}, 延迟: ${args[1]}ms)`);
  return id;
};

console.log('\n=== 测试设置完成 ===');
console.log('请执行以下操作：');
console.log('1. 点击页面上的"选择文件"按钮');
console.log('2. 选择图片文件');
console.log('3. 观察控制台输出');
console.log('4. 如果页面刷新，查看刷新前的最后日志');
console.log('\n当前定时器数量:', {
  intervals: timerTypes.intervals.length,
  timeouts: timerTypes.timeouts.length,
});
