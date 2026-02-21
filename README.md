# Branch Security Cost Submission System

A modern web application for Air Zeta's branch offices to submit and manage monthly security-related expenses. Built with React + Firebase.

**Live App**: https://mark4mission.github.io/airzeta-security-fee-app/

---

## Features

### Authentication
- Email/Password login with self-registration
- Google Sign-In
- Password reset via email
- Role-based access: HQ Admin, Branch User, Pending Admin

### Cost Management
- Submit monthly **Estimated** and **Actual** security costs per branch
- Dynamic cost items with Unit Price x Quantity auto-calculation
- Multi-currency support (USD, EUR, KRW, JPY, SGD, HKD, THB, GBP, CNY)
- **KRW Exchange Rate** conversion display for HQ admin (shows branch-specific currency label)
- Business rule enforcement:
  - Estimated Cost: current/past months only
  - Actual Cost: after 28th of the month only
- **Manager Name sync**: Editing manager name in submission automatically updates branch settings

### Admin Dashboard
- Monthly grid: all branches x 12 months
- Color-coded cells with Estimated/Actual amounts and variance %
- Click any cell to load that branch/month data
- Recent update indicators

### Cost History
- Per-branch bar chart (Estimated vs Actual by month)
- Year selector with summary cards (Total Est, Total Act, Variance)
- Month-over-Month change tracking

### Settings (Admin Only)
- Manage branches (name, manager, currency, payment method)
- Manage cost items, currencies, payment methods
- User management with role assignment and pending admin approval
- All settings synced to Firestore

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Icons | Lucide React |
| Deployment | GitHub Pages |
| Styling | Inline CSS |

---

## Quick Start

```bash
# Clone
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app

# Install
npm install

# Create .env (Firebase config)
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
EOF

# Run dev server
npm run dev

# Build & deploy
npm run deploy
```

---

## Documentation

| File | Purpose |
|------|---------|
| `PROJECT_CONTEXT.md` | Complete project documentation (architecture, Firebase, features, data models, PR history, known issues) |
| `AI_HANDOFF_PROMPT.md` | Ready-to-use prompt for AI coding assistants (Genspark, Claude, Cursor, Copilot) |
| `CLAUDE.md` | Quick-start instructions for Claude / Cursor AI |
| `GEMINI.md` | Quick-start instructions for Genspark / Gemini AI |
| `AVIATION_SECURITY_HUB_DEV_GUIDE.md` | Original Korean development guide |

---

## Project Structure

```
src/
  App.jsx                   # Main component (form, state, submission) - 1,498 lines
  components/
    Login.jsx               # Login / Register / Forgot Password - 632 lines
    BranchSelection.jsx     # First-time branch picker - 479 lines
    AdminDashboard.jsx      # Monthly cost grid - 284 lines
    BranchCostHistory.jsx   # Bar chart + detail table - 413 lines
    Settings.jsx            # Admin settings modal - 1,387 lines
    UserManagement.jsx      # User role management - 394 lines
  firebase/
    config.js               # Firebase initialization - 29 lines
    auth.js                 # Authentication functions - 501 lines
    collections.js          # Firestore CRUD operations - 336 lines
scripts/
  seed-test-data.mjs        # Test data seeder - 532 lines
```

---

## Test Accounts

| Account | Role | Branch |
|---------|------|--------|
| mark4mission@gmail.com | HQ Admin | All branches |
| alasu@test.airzeta.com / Test1234! | Branch User | ALASU (USD) |
| bkksu@test.airzeta.com / Test1234! | Branch User | BKKSU (THB) |

See `scripts/seed-test-data.mjs` for full test data setup.

---

## Backup & Restore

### Git Tags
```bash
# Latest backup:
git checkout backup-2026-02-21-v6-final-docs

# Create branch from backup:
git checkout -b restore-branch backup-2026-02-21-v6-final-docs
```

### Available Tags
| Tag | Description |
|-----|-------------|
| `backup-2026-02-21-v6-final-docs` | Latest: all features + documentation |
| `backup-2026-02-21-v5-final-manager-sync` | Manager name sync feature |
| `backup-2026-02-21-v4-pre-krw-currency-fix` | Before KRW currency fixes |
| `backup-2026-02-21-v3-pre-krw-fix` | Before KRW fixes |
| `backup-2026-02-21-v2-variance-indicator` | Variance indicator feature |
| `backup-2026-02-21-hq-admin-approval` | HQ admin approval flow |

---

## License

MIT
