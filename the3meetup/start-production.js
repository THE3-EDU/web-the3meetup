const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动生产环境服务...\n');

// 加载生产环境变量
require('dotenv').config({ path: '.env.production' });

// 启动WebSocket服务器
const wsServer = spawn('node', ['websocket-server.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'production' }
});

console.log('✅ WebSocket服务器已启动 (端口: 3001)');

// 等待一秒后启动Next.js应用
setTimeout(() => {
  const nextApp = spawn('npm', ['start'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  console.log('✅ Next.js应用已启动 (端口: 3000)');
  console.log('\n📱 访问地址:');
  console.log('   • 主页面: http://your-domain.com');
  console.log('   • WebSocket服务器: ws://your-domain.com:3001');
  console.log('\n🔄 按 Ctrl+C 停止所有服务\n');

  // 处理进程退出
  process.on('SIGINT', () => {
    console.log('\n🛑 正在停止服务...');
    wsServer.kill();
    nextApp.kill();
    process.exit(0);
  });

  // 处理子进程退出
  wsServer.on('close', (code) => {
    console.log(`WebSocket服务器已退出，代码: ${code}`);
    nextApp.kill();
  });

  nextApp.on('close', (code) => {
    console.log(`Next.js应用已退出，代码: ${code}`);
    wsServer.kill();
  });

}, 1000);

// 处理WebSocket服务器退出
wsServer.on('close', (code) => {
  console.log(`WebSocket服务器已退出，代码: ${code}`);
}); 