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

# Create .env file (REQUIRED - not in git)
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
git checkout main && git pull origin main
```

### Key Commands
```bash
npm run dev          # Local dev server (port 5173)
npm run build        # Production build (ALWAYS verify before commit!)
npm run deploy       # Build + deploy to GitHub Pages
```

### Genspark-Specific Workflow
1. Always use `genspark_ai_developer` branch for development
2. **Start**: `git checkout -B genspark_ai_developer origin/main`
3. Make changes, verify build: `npm run build`
4. Commit: `git add -A && git commit -m "type(scope): description"`
5. Push: `git push -f origin genspark_ai_developer`
6. Create PR: `gh pr create --base main --head genspark_ai_developer --title "..." --body "..."`
7. Deploy: `npm run deploy`
8. Merge: `gh pr merge <number> --merge`
9. Always provide PR link to user
10. Squash commits before merging if multiple

### Architecture Summary
- **App.jsx** (1,498 lines): Main component - all state, form handling, submission logic
- **firebase/**: `config.js` (init from .env), `auth.js` (authentication), `collections.js` (Firestore CRUD)
- **components/**: Login, BranchSelection, AdminDashboard, BranchCostHistory, Settings, UserManagement
- **Styling**: All inline CSS (`style={{}}`), color constants via `COLORS` object in each component
- **No Router/Redux/TypeScript** - pure React hooks (useState, useEffect, useCallback, useMemo)

### Firestore Collections
| Collection | Purpose | Doc ID | Key Fields |
|-----------|---------|--------|------------|
| `branchCodes` | Branch settings | Branch name | name, manager, currency, paymentMethod |
| `securityCosts` | Submitted costs | Auto-generated | branchName, targetMonth, items[], totalEstimated, totalActual |
| `users` | User profiles | Firebase Auth UID | email, role, branchName, preferredCurrency |
| `settings/appSettings` | App config | Fixed "appSettings" | costItems[], currencies[], paymentMethods[] |

### User Roles
- `hq_admin`: Full access (dashboard, all branches, settings, user management)
- `branch_user`: Own branch only (submit costs, view history)
- `pending_admin`: Awaiting approval (cannot access any features)

### Critical Rules
- **Currency display uses `branch.currency`** (NOT user preferences) - caused past bugs
- Estimated Cost editable only for current/past months
- Actual Cost editable only after 28th of target month
- Manager name syncs to `branchCodes` on submit via `updateBranchManager()`
- Firestore queries: avoid compound indexes, use client-side filtering
- Unicode in JSX: use template literals or JS expressions, not bare text
- After submit with `serverTimestamp()`, wait 1.5s before re-query
- KRW Exchange Rate helper text dynamically shows branch currency (e.g., "Enter the THB to KRW exchange rate")

### Test Accounts
```
Admin: mark4mission@gmail.com (hq_admin)
Branch: bkksu@test.airzeta.com / Test1234! (BKKSU, THB)
Branch: alasu@test.airzeta.com / Test1234! (ALASU, USD)
```

### Backup & Restore
```bash
# Latest backup tag:
git checkout backup-2026-02-21-v6-final-docs

# Create branch from backup:
git checkout -b restore-branch backup-2026-02-21-v6-final-docs

# Backup archive (if available): airzeta_backup_2026-02-21_v6_final.tar.gz
```

### Full Documentation
Read `PROJECT_CONTEXT.md` in the repository root for:
- Complete feature descriptions and user flows
- All Firestore data models with example documents
- File structure with line counts
- Implementation details and past bug fixes
- PR history (#1 ~ #23)
- Known issues and technical debt
