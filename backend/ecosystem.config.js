// ─── PM2 Ecosystem Config ────────────────────────────────────────────────────
// Used on the college server to keep the backend alive permanently.
//
// Start:   pm2 start ecosystem.config.js
// Restart: pm2 restart exam-backend
// Logs:    pm2 logs exam-backend
// Status:  pm2 list
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    {
      name: 'exam-backend',
      script: 'server.js',

      // ── Environment ──────────────────────────────────────────────────────
      // PM2 will pick up backend/.env automatically via dotenv in server.js.
      // Do NOT put secrets here — keep them in backend/.env on the server.
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // ── Restart policy ───────────────────────────────────────────────────
      watch: false,               // do NOT watch files in production
      autorestart: true,          // restart on crash
      max_restarts: 10,           // stop retrying after 10 failures
      min_uptime: '10s',          // consider it stable after 10s
      restart_delay: 3000,        // wait 3s between restarts

      // ── Resource limits ──────────────────────────────────────────────────
      max_memory_restart: '400M', // restart if RAM exceeds 400 MB

      // ── Logs ─────────────────────────────────────────────────────────────
      output: './logs/pm2-out.log',
      error: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
