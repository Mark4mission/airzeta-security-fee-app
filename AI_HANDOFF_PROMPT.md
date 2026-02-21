# AI Handoff Prompt - Air Zeta Security Fee App

> Copy this entire file as a prompt when starting a new AI session (Genspark, Claude, Cursor, Copilot, etc.)
> This prompt contains ALL information needed to continue development on this project.

---

## PROMPT START

You are continuing development on the **Air Zeta Security Fee App**, a React + Firebase web application for managing branch office security costs across international offices.

### Project Summary
This is a single-page React app (no Router) where:
- **HQ Admin** can view a dashboard of all branches, submit/edit security costs for any branch, manage settings (branches, cost items, currencies), and manage users
- **Branch Users** can submit Estimated/Actual costs for their own branch only and view their cost history
- **Pending Admin** users wait for HQ approval after selecting "HQ" during registration

### Repository
```
GitHub:  https://github.com/Mark4mission/airzeta-security-fee-app
Branch:  main (production, deployed to GitHub Pages)
Dev:     genspark_ai_developer (feature work, create PR to main)
Live:    https://mark4mission.github.io/airzeta-security-fee-app/
```

### Clone & Setup
```bash
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app
npm install

# Create .env with Firebase config (REQUIRED - not in git)
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
EOF

npm run dev    # Start dev server on port 5173
npm run build  # Production build -> dist/
npm run deploy # Build + deploy to GitHub Pages
```

### If Working in Genspark Sandbox
```bash
# Project is already at /home/user/webapp
cd /home/user/webapp
git checkout main && git pull origin main

# If .env is missing:
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
EOF
```

### Restoring from Backup
```bash
# Option 1: From Git tag
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app
git checkout backup-2026-02-21-v6-final-docs
npm install && cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
EOF

# Option 2: From archive (if available)
tar -xzf airzeta_backup_2026-02-21_v6_final.tar.gz -C project-dir
cd project-dir && npm install
# Create .env as above
```

### Tech Stack
- **React 19** + **Vite 7** (no TypeScript, no Router, no Redux/Zustand)
- **Firebase Firestore** for database, **Firebase Auth** for authentication (Email/Password + Google)
- **Lucide React** for icons
- **Inline CSS** for all styling (`style={{}}` objects, `COLORS` constant, no Tailwind/CSS modules)
- **GitHub Pages** deployment via `npm run deploy` (uses `gh-pages` package)

### Firebase Project
- Project ID: `airzeta-security-system`
- Firestore collections: `branchCodes`, `securityCosts`, `users`, `settings`
- Auth: Email/Password + Google Sign-In
- Console: https://console.firebase.google.com/project/airzeta-security-system

### File Structure (key files)
```
src/
  App.jsx                   # Main component (1,498 lines) - form, submission, all state
  components/
    Login.jsx               # Auth UI: login/register/forgot password (632 lines)
    BranchSelection.jsx     # First-time branch picker (479 lines)
    AdminDashboard.jsx      # Monthly cost grid for admin (284 lines)
    BranchCostHistory.jsx   # Bar chart + table per branch (413 lines)
    Settings.jsx            # Admin settings modal (1,387 lines)
    UserManagement.jsx      # User role management (394 lines)
  firebase/
    config.js               # Firebase init (reads .env, 29 lines)
    auth.js                 # All auth functions (501 lines)
    collections.js          # All Firestore CRUD (336 lines)
scripts/
  seed-test-data.mjs        # Test data seeder (532 lines)
```

### User Roles
- `hq_admin`: Full access - dashboard, all branches, settings, user management, KRW exchange rate
- `branch_user`: Own branch only - submit costs, view own history
- `pending_admin`: Awaiting admin approval after selecting "HQ" during registration

### Key Business Logic
1. **Estimated Cost** = Unit Price x Quantity (auto-calculated)
2. **Estimated Cost** only editable for current/past months
3. **Actual Cost** only editable after the 28th of the target month
4. **KRW Exchange Rate** (admin only): multiplied by cost amounts to show `≈ ₩xxx` conversion
   - Helper text uses branch currency: "Enter the THB to KRW exchange rate" for Bangkok
5. **Auto-load**: Branch/month change triggers automatic data load from Firestore
6. **Manager sync**: Editing manager name + submit updates `branchCodes` collection
7. **Currency**: ALWAYS uses `branch.currency` (not `preferredCurrency`) for display
8. **Post-submit**: Branch user data reloads after 1.5s delay; Admin form resets

### Firestore Collections
| Collection | Doc ID | Key Fields |
|-----------|--------|------------|
| `branchCodes` | Branch name (e.g., "BKKSU") | branchName, manager, currency, paymentMethod, active |
| `securityCosts` | Auto-generated | branchName, managerName, targetMonth, currency, krwExchangeRate, items[], totalEstimated, totalActual, submittedAt, submittedBy |
| `users` | Firebase Auth UID | email, role, branchName, displayName, preferredCurrency, preferredPaymentMethod |
| `settings/appSettings` | Fixed: "appSettings" | costItems[], currencies[], paymentMethods[] |

### Test Accounts
```
Admin: mark4mission@gmail.com (hq_admin)
Branch users: <branch>@test.airzeta.com / Test1234!
  Branches: ALASU (USD), TYOSU (JPY), SINSU (SGD), HKGSU (HKD), BKKSU (THB), SFOSF (USD)
```

### Development Workflow
```bash
git checkout main && git pull origin main
git checkout -B genspark_ai_developer origin/main
# ... make changes ...
npm run build                    # ALWAYS verify no build errors
git add -A && git commit -m "type(scope): description"
git push -f origin genspark_ai_developer
gh pr create --base main --head genspark_ai_developer --title "..." --body "..."
npm run deploy                   # deploy to GitHub Pages
gh pr merge <number> --merge     # merge PR
git checkout main && git pull    # sync local main
```

### Current State (as of 2026-02-21)
- Latest tag: `backup-2026-02-21-v6-final-docs`
- Last PR merged: #23 (Documentation for AI handoff)
- All features working: login, dashboard, cost submission, auto-load, graph, settings, multi-currency, KRW conversion, manager sync
- No known critical bugs
- See `PROJECT_CONTEXT.md` in repo for complete documentation (architecture, data models, PR history, etc.)

### Critical Rules for AI Developers
1. **No .env in git**: Always create `.env` from the values above
2. **Inline CSS only**: No CSS classes, no Tailwind - all styling is `style={{}}` objects with `COLORS` constant
3. **Korean comments**: Many code comments are in Korean - preserve them
4. **Currency from branch**: Use `branch.currency`, NEVER `currentUser.preferredCurrency` for display
5. **Firestore queries**: Avoid compound queries needing composite indexes; use single-field queries + client-side filtering
6. **Unicode in JSX**: Use JS expressions `{'\u2248'}` or template literals `` {`≈ ₩${value}`} ``, not bare text
7. **Post-submit timing**: Allow 1.5s+ for Firestore `serverTimestamp()` to propagate before re-querying
8. **Color constants**: Use `COLORS` object defined at top of each component
9. **Build check**: Always run `npm run build` before committing to catch errors
10. **Manager sync**: After `submitSecurityCost()`, check if manager name changed and call `updateBranchManager()` if so
11. **Read PROJECT_CONTEXT.md**: Full documentation of all features, data models, and implementation details

## PROMPT END
