# CLAUDE.md - Claude / Cursor AI Instructions

## Project: Air Zeta Security Fee App

### Quick Context
React 19 + Vite 7 + Firebase Firestore/Auth app for branch office security cost management.
See `PROJECT_CONTEXT.md` for full documentation and `AI_HANDOFF_PROMPT.md` for setup.

### Repository
```
https://github.com/Mark4mission/airzeta-security-fee-app
Production branch: main
Development branch: genspark_ai_developer
```

### Commands
```bash
npm install          # Install deps
npm run dev          # Dev server (port 5173)
npm run build        # Production build
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
- All styling is inline CSS (`style={{}}`) - no Tailwind, no CSS modules
- Korean comments throughout codebase - preserve them
- Firestore has 4 collections: `branchCodes`, `securityCosts`, `users`, `settings`
- No React Router - navigation is conditional rendering based on `currentUser` state
- No TypeScript - pure JSX

### Key Files to Read First
1. `src/App.jsx` - Main component, all form logic and state
2. `src/firebase/collections.js` - All Firestore queries
3. `src/firebase/auth.js` - Authentication and user management
4. `src/components/AdminDashboard.jsx` - Admin monthly grid

### Common Pitfalls
- Currency must come from `branch.currency`, NOT `currentUser.preferredCurrency`
- Firestore compound queries need composite indexes; prefer single-field + client filter
- Unicode escapes in JSX must be in JS expressions: `{'\u2248'}` not bare `\u2248`
- After Firestore write with `serverTimestamp()`, wait 1.5s+ before re-querying
- `npm run deploy` requires GitHub auth configured (uses `gh-pages` package)

### Git Workflow
```bash
git checkout -B genspark_ai_developer origin/main
# make changes
npm run build  # ALWAYS verify build passes
git add -A && git commit -m "type(scope): description"
git push -f origin genspark_ai_developer
# create PR, deploy, merge
```
