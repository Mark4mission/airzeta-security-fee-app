# GEMINI.md - Genspark / Antigravity AI Instructions

> **Last Updated**: 2026-03-03 (Session 10)
> **Document Version**: 2.0

## Project: AirZeta Station Security Portal

### Quick Context
React 19 + Vite 7 + Firebase multi-module aviation security portal. Manages security threat levels, bulletins, fees, documents, and policies for worldwide branch stations.

**Full Documentation**: `PROJECT_GUIDE.md` (v1.8)

### Repository & URLs
```
GitHub:   https://github.com/Mark4mission/airzeta-security-fee-app
Main:     main (production)
Dev:      genspark_ai_developer (feature work → PR to main)
Vercel:   https://airzeta-security-fee-app.vercel.app (auto-deploy from main)
GH Pages: npm run deploy
```

### Setup
```bash
# Fresh clone
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app && npm install

# .env (REQUIRED)
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
VITE_GEMINI_API_KEY=<your-gemini-api-key>
EOF

# In Genspark sandbox:
cd /home/user/webapp && git checkout main && git pull origin main
```

### Commands
```bash
npm run dev          # Dev server (port 5173)
npm run build        # Production build (ALWAYS run before commit)
npm run deploy       # Build + deploy to GitHub Pages
npm run lint         # ESLint check
npm run preview      # Preview production build locally
```

### Architecture Overview
- **Routing**: HashRouter in `App.jsx` → module pages
- **Auth**: Firebase Auth (Email/Password + Google) via `AuthContext.jsx`
- **Layout**: `PortalLayout.jsx` (sidebar + content)
- **Styling**: All inline CSS (`style={{}}`), `COLORS` constant per component, dark navy theme
- **State**: Pure React hooks (useState, useEffect, useCallback, useMemo)
- **No TypeScript, No Redux, No CSS modules**

### Modules
| Module | Route | Key File | Description |
|--------|-------|----------|-------------|
| Home | `/` | `modules/home/HomePage.jsx` | Dashboard cards (bulletin, security level mini-map, fee chart, pledge donut, news) |
| Bulletin | `/bulletin/*` | `modules/bulletin/` | Post CRUD, rich text + markdown, translation, acknowledgement |
| Security Level | `/security-level` | `modules/security-level/SecurityLevelPage.jsx` | TopoJSON world map (all users read-only, admin edit), branch threat levels |
| Security Fee | `/security-fee` | `modules/security-fee/` | Cost management, admin dashboard, branch history |
| Document Library | `/document-library/*` | `modules/document-library/` | File upload, categories, download tracking |
| Security Policy | `/security-policy` | `modules/security-policy/SecurityPolicyPage.jsx` | Policy references |
| Important Links | `/important-links` | `modules/important-links/ImportantLinksPage.jsx` | External links |
| Settings | `/settings` | `modules/settings/SettingsPage.jsx` | Branch, cost items, currencies config |

### Firestore Collections
| Collection | Key Fields |
|-----------|------------|
| `branchCodes` | branchName, manager, currency, paymentMethod, active |
| `securityCosts` | branchName, targetMonth, items[], totalEstimated, totalActual |
| `users` | email, role (hq_admin/branch_user), branchName |
| `settings/appSettings` | costItems[], currencies[], paymentMethods[] |
| `securityLevels` | branchName, levels, activeLevel, airportCode, history |
| `bulletins` | title, content, category, acknowledgements, comments |
| `documentLibrary` | title, category, fileUrl, downloadCount |

### Genspark AI Developer Workflow
```bash
git checkout main && git pull origin main
git checkout -B genspark_ai_developer origin/main
# ... make changes ...
npm run build                    # ALWAYS verify 0 errors
git add -A && git commit -m "type(scope): description"
git push -f origin genspark_ai_developer
gh pr create --base main --head genspark_ai_developer --title "..." --body "..."
# After merge:
git checkout main && git pull
npm run deploy                   # GitHub Pages deploy
# Vercel auto-deploys from main branch
```

### Critical Rules
1. **Build check**: `npm run build` before every commit (0 errors required)
2. **Inline CSS only**: `style={{}}` with `COLORS` constant — no Tailwind, no class names
3. **DOMPurify**: ALL `dangerouslySetInnerHTML` MUST use `DOMPurify.sanitize()`
4. **AIRPORT_COORDS**: When adding airports, update BOTH `SecurityLevelPage.jsx` (full coords) AND `HomePage.jsx` (mini coords)
5. **Currency**: Always `branch.currency`, never `currentUser.preferredCurrency`
6. **Korean comments**: Preserve all existing Korean comments in code
7. **TopoJSON**: `/public/countries-110m.json` must exist for map rendering
8. **Firestore**: Avoid compound indexes; prefer single-field queries + client-side filter
9. **Post-submit**: Wait 1.5s+ after `serverTimestamp()` before re-querying

### Test Accounts
```
Admin: mark4mission@gmail.com (hq_admin)
Branch: bkksu@test.airzeta.com / Test1234! (BKKSU, THB)
Branch: alasu@test.airzeta.com / Test1234! (ALASU, USD)
```

### Backup & Restore
```bash
# Latest backup tag:
git checkout backup-2026-03-03-v10-session10
# Or from archive:
tar -xzf airzeta_backup_2026-03-03_session10.tar.gz
```

### Current State (2026-03-03)
- PROJECT_GUIDE.md v1.8, Build: 0 errors, 2,543 modules
- All modules functional, DOMPurify applied, ANC airport added
- Last PR: #60 (Session 10)
- Read `PROJECT_GUIDE.md` for full changelog, troubleshooting, and architecture details
