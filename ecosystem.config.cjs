/**
 * PM2 process file for EC2 (Node 22).
 *
 * Install once on the host:  sudo npm i -g pm2
 * First start:               pm2 start ecosystem.config.cjs
 * After deploys:             ./scripts/deploy.sh
 * Boot persistence:          pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "leno-os",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
