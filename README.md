# 🔔 TeleMonitor Pro

> Production-ready Telegram monitoring SaaS built with Node.js

## ✨ Features

- 📡 Real-time Telegram message monitoring (GramJS)
- 📱 WhatsApp alerts (Personal + Business mode)
- 👥 Multi-user SaaS system
- 🛡️ Admin panel with full controls
- 🎫 Support ticket system
- 📢 Broadcast system
- ✅ Bio verification
- 📋 Force join system
- 💾 JSON-based storage with auto backups

---

## 📁 Project Structure

src/
├── index.js        ← Main bot + all user handlers
├── config.js       ← Dynamic settings manager
├── storage.js      ← JSON storage engine
├── core.js         ← GramJS + WhatsApp engine
├── admin.js        ← Admin panel + broadcast
└── wa_business.js  ← WhatsApp Business features

---

## 🚀 Quick Setup

### 1. Clone
\`\`\`bash
git clone https://github.com/yourusername/telegram-monitor-saas
cd telegram-monitor-saas
\`\`\`

### 2. Install
\`\`\`bash
npm install
\`\`\`

### 3. Configure
\`\`\`bash
cp .env.example .env
nano .env
\`\`\`

### 4. Run
\`\`\`bash
# Development
npm run dev

# Production (PM2)
npm run pm2

# Docker
docker-compose up -d
\`\`\`

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| BOT_TOKEN | ✅ | Telegram bot token from @BotFather |
| ADMIN_IDS | ✅ | Comma-separated admin Telegram IDs |
| OWNER_ID | ✅ | Owner Telegram ID |
| ADMIN_WA_NUMBER | ⭕ | WhatsApp Business number |
| APP_NAME | ⭕ | Your app name |
| NODE_ENV | ⭕ | production / development |

---

## 📖 Docs

- [Setup Guide](docs/SETUP.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

---

## 🛡️ Admin Commands

| Command | Description |
|---------|-------------|
| /admin | Open admin panel |
| /lookup <id> | Look up user info |
| /reply <msg> | Reply to active ticket |

---

## 📜 License

MIT License
