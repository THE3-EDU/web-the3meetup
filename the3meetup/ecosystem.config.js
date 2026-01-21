module.exports = {
  apps: [
    {
      name: 'websocket-server',
      script: 'websocket-server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pm2-websocket-error.log',
      out_file: './logs/pm2-websocket-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // SSL 证书路径（根据需要修改）
      // env_production: {
      //   SSL_CERT_PATH: 'C:\\ssl\\server.crt',
      //   SSL_KEY_PATH: 'C:\\ssl\\server.key'
      // }
    }
  ]
};

