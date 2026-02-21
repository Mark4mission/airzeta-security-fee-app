# CLAUDE.md - Claude / Cursor AI Instructions

## Project: Air Zeta Security Fee App

### Quick Context
React 19 + Vite 7 + Firebase Firestore/Auth app for branch office security cost management.
See `PROJECT_CONTEXT.md` for full documentation and `AI_HANDOFF_PROMPT.md` for complete setup prompt.

### Repository
```
https://github.com/Mark4mission/airzeta-security-fee-app
Production branch: main
Development branch: genspark_ai_developer
Live URL: https://mark4mission.github.io/airzeta-security-fee-app/
```

### Commands
```bash
npm install          # Install deps
npm run dev          # Dev server (port 5173)
npm run build        # Production build (ALWAYS run before commit)
npm run deploy       # Build + deploy to GitHub Pages
```

### Firebase .env (create in project root if missing)
```env
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
```

### Architecture Notes
- Single `App.jsx` (1,498 lines) is the main component with all state
- All styling is inline CSS (`style={{}}`) - no Tailwind, no CSS modules, no CSS classes
- `COLORS` constant defined at top of each component for consistent theming
- Korean comments (한국어) throughout codebase - preserve them
- Firestore has 4 collections: `branchCodes`, `securityCosts`, `users`, `settings`
- No React Router - navigation is conditional rendering based on `currentUser` state and role
- No TypeScript - pure JSX
- No state management library - pure useState/useEffect/useCallback

### Key Files to Read First
1. `src/App.jsx` - Main component, all form logic, state management, submission
2. `src/firebase/collections.js` - All Firestore queries and CRUD operations
3. `src/firebase/auth.js` - Authentication, user management, role checking
4. `src/components/AdminDashboard.jsx` - Admin monthly cost grid
5. `src/components/BranchCostHistory.jsx` - Per-branch bar chart and history

### Common Pitfalls
- **Currency MUST come from `branch.currency`**, NOT `currentUser.preferredCurrency` (caused major bugs)
- Firestore compound queries need composite indexes; prefer single-field `where()` + client filter
- Unicode escapes in JSX must be in JS expressions: `` {`≈ ₩${value}`} `` not bare `\u2248 \u20A9`
- After Firestore write with `serverTimestamp()`, wait 1.5s+ before re-querying
- `npm run deploy` requires GitHub auth configured (uses `gh-pages` package)
- Manager name sync: after submit, check if manager changed and call `updateBranchManager()`
- BranchCostHistory component only renders when `branchName` is truthy
- Post-submit: admin form resets, branch_user data reloads after 1.5s delay

### Git Workflow
```bash
git checkout main && git pull origin main
git checkout -B genspark_ai_developer origin/main
# make changes
npm run build  # ALWAYS verify build passes before commit
git add -A && git commit -m "type(scope): description"
git push -f origin genspark_ai_developer
# create PR, deploy, merge
npm run deploy  # deploy to GitHub Pages
```

### Test Accounts
```
Admin: mark4mission@gmail.com (hq_admin)
Branch: bkksu@test.airzeta.com / Test1234! (BKKSU, THB)
Branch: alasu@test.airzeta.com / Test1234! (ALASU, USD)
```
