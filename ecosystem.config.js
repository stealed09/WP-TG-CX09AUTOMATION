module.exports = {
  apps: [
    {
      name: 'telegram-monitor',
      script: './src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './data/logs/pm2-error.log',
      out_file: './data/logs/pm2-out.log',
      log_file: './data/logs/pm2-combined.log',
      time: true,
    },
  ],
};
