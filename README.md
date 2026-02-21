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
- **KRW Exchange Rate** conversion display for HQ admin
- Business rule enforcement:
  - Estimated Cost: current/past months only
  - Actual Cost: after 28th of the month only

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
- Manage branches, cost items, currencies, payment methods
- All settings synced to Firestore
- Manager name auto-syncs on submit

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
| `PROJECT_CONTEXT.md` | Complete project documentation (architecture, Firebase, features, data models) |
| `AI_HANDOFF_PROMPT.md` | Ready-to-use prompt for AI coding assistants |
| `CLAUDE.md` | Instructions for Claude / Cursor AI |
| `GEMINI.md` | Instructions for Genspark / Gemini AI |

---

## Project Structure

```
src/
  App.jsx                   # Main component (form, state, submission)
  components/
    Login.jsx               # Login / Register / Forgot Password
    BranchSelection.jsx     # First-time branch picker
    AdminDashboard.jsx      # Monthly cost grid
    BranchCostHistory.jsx   # Bar chart + detail table
    Settings.jsx            # Admin settings modal
    UserManagement.jsx      # User role management
  firebase/
    config.js               # Firebase initialization
    auth.js                 # Authentication functions
    collections.js          # Firestore CRUD operations
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

## License

MIT
