# GEMINI.md - Genspark / Gemini AI Instructions

## Project: Air Zeta Security Fee App

### Quick Context
React 19 + Vite 7 + Firebase Firestore/Auth web app for managing branch security costs across international offices. See `PROJECT_CONTEXT.md` for complete documentation.

### Repository
```
GitHub: https://github.com/Mark4mission/airzeta-security-fee-app
Production: main branch
Development: genspark_ai_developer branch
Live URL: https://mark4mission.github.io/airzeta-security-fee-app/
```

### Setup (if working in sandbox)
```bash
# If cloning fresh:
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app
npm install

# Create .env file
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
EOF

# If sandbox already has the project:
cd /home/user/webapp
```

### Key Commands
```bash
npm run dev          # Local dev server (port 5173)
npm run build        # Production build (verify before commit!)
npm run deploy       # Build + deploy to GitHub Pages
```

### Genspark-Specific Workflow
1. Always use `genspark_ai_developer` branch for development
2. Commit after EVERY code change
3. Create/update PR after every commit
4. Squash commits before merging if multiple
5. Always provide PR link to user
6. Run `npm run build` before committing
7. Deploy with `npm run deploy` after PR creation

### Architecture Summary
- **App.jsx** (1,498 lines): Main component - all state, form handling, submission logic
- **firebase/**: `config.js` (init), `auth.js` (authentication), `collections.js` (Firestore CRUD)
- **components/**: Login, BranchSelection, AdminDashboard, BranchCostHistory, Settings, UserManagement
- **Styling**: All inline CSS (`style={{}}`), color constants via `COLORS` object
- **No Router/Redux/TypeScript** - pure React hooks

### Firestore Collections
| Collection | Purpose | Key Fields |
|-----------|---------|------------|
| `branchCodes` | Branch settings | name, manager, currency, paymentMethod |
| `securityCosts` | Submitted costs | branchName, targetMonth, items[], totalEstimated, totalActual |
| `users` | User profiles | email, role, branchName, preferredCurrency |
| `settings` | App config | costItems[], currencies[], paymentMethods[] |

### Critical Rules
- Currency display uses `branch.currency` (NOT user preferences)
- Estimated Cost editable only for current/past months
- Actual Cost editable only after 28th of target month
- Manager name syncs to branchCodes on submit
- Firestore queries: avoid compound indexes, use client-side filtering
- Unicode in JSX: use template literals or JS expressions, not bare text
- After submit with serverTimestamp, wait 1.5s before re-query
