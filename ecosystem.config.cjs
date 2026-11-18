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
        SKIP_ENV_VALIDATION: "0",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
      },
    },
    {
      name: "leno-os-scheduler",
      cwd: __dirname,
      script: "scripts/scheduler.ts",
      interpreter: "node",
      node_args: "--import ./scripts/load-env.mjs --import tsx",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "256M",
      kill_timeout: 120000,
      env: {
        NODE_ENV: "production",
        SKIP_ENV_VALIDATION: "0",
      },
    },
  ],
};
