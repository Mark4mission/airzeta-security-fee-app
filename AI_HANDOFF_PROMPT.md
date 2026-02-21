# AI Handoff Prompt - Air Zeta Security Fee App

> Copy this entire file as a prompt when starting a new AI session (Genspark, Claude, Cursor, etc.)

---

## PROMPT START

You are continuing development on the **Air Zeta Security Fee App**, a React + Firebase web application for managing branch office security costs. Read `PROJECT_CONTEXT.md` in the repository root for full documentation.

### Repository
```
GitHub:  https://github.com/Mark4mission/airzeta-security-fee-app
Branch:  main (production)
Dev:     genspark_ai_developer (feature work)
```

### Clone & Setup
```bash
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app
npm install

# Create .env with Firebase config
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
EOF
```

### Tech Stack
- **React 19** + **Vite 7** (no TypeScript, no Router, no state library)
- **Firebase Firestore** for database, **Firebase Auth** for authentication
- **Lucide React** for icons, **inline CSS** for all styling
- **GitHub Pages** deployment via `npm run deploy` (uses `gh-pages` package)

### Firebase Project
- Project ID: `airzeta-security-system`
- Firestore collections: `branchCodes`, `securityCosts`, `users`, `settings`
- Auth: Email/Password + Google Sign-In

### File Structure (key files)
```
src/
  App.jsx                   # Main component (1,498 lines) - form, submission, state
  components/
    Login.jsx               # Auth UI (login/register/forgot)
    BranchSelection.jsx     # First-time branch picker
    AdminDashboard.jsx      # Monthly cost grid for admin
    BranchCostHistory.jsx   # Bar chart + table per branch
    Settings.jsx            # Admin settings modal
    UserManagement.jsx      # User role management
  firebase/
    config.js               # Firebase init (reads .env)
    auth.js                 # All auth functions
    collections.js          # All Firestore CRUD
```

### User Roles
- `hq_admin`: Full access - dashboard, all branches, settings, user management
- `branch_user`: Own branch only - submit costs, view own history
- `pending_admin`: Awaiting admin approval after selecting "HQ"

### Key Business Logic
1. **Estimated Cost** = Unit Price x Quantity (auto-calculated)
2. **Estimated Cost** only editable for current/past months
3. **Actual Cost** only editable after the 28th of the target month
4. **KRW Exchange Rate** (admin only): multiplied by cost amounts to show `≈ ₩xxx` conversion
5. **Auto-load**: Branch/month change triggers automatic data load from Firestore
6. **Manager sync**: Editing manager name + submit updates `branchCodes` collection
7. **Currency**: Always uses `branch.currency` (not `preferredCurrency`) for display

### Development Workflow
```bash
git checkout -B genspark_ai_developer origin/main
# ... make changes ...
npm run build                    # verify no errors
git add -A && git commit -m "type: description"
git push -f origin genspark_ai_developer
gh pr create --base main --head genspark_ai_developer --title "..." --body "..."
npm run deploy                   # deploy to GitHub Pages
gh pr merge <number> --merge     # merge PR
```

### Current State (as of 2026-02-21)
- Latest tag: `backup-2026-02-21-v5-final-manager-sync`
- Last PR merged: #22 (Manager name sync on submit)
- All features working: login, dashboard, cost submission, auto-load, graph, settings, multi-currency, KRW conversion
- No known critical bugs

### Test Accounts
```
Admin: mark4mission@gmail.com (hq_admin)
Branch users: <branch>@test.airzeta.com / Test1234!
  Branches: ALASU (USD), TYOSU (JPY), SINSU (SGD), HKGSU (HKD), BKKSU (THB), SFOSF (USD)
```

### Important Notes for AI Developers
1. **No .env in git**: Always create `.env` from the values above
2. **Inline CSS only**: No CSS classes, no Tailwind - all styling is `style={{}}` objects
3. **Korean comments**: Many code comments are in Korean - this is intentional
4. **Firestore queries**: Avoid compound queries needing composite indexes; use single-field queries + client-side filtering
5. **Unicode in JSX**: Use JS expressions `{'\u2248'}` or template literals, not bare text
6. **Post-submit timing**: Allow 1.5s+ for Firestore `serverTimestamp()` to propagate before re-querying
7. **Color constants**: Use `COLORS` object defined at top of each component
8. **Build check**: Always run `npm run build` before committing to catch errors

## PROMPT END
