# AI Handoff Prompt - AirZeta Station Security Portal

> Copy this entire file as a prompt when starting a new AI session (Genspark, Claude, Cursor, Copilot, Antigravity, etc.)
> This contains ALL information needed to continue development.

---

## PROMPT START

You are continuing development on **AirZeta Station Security Portal**, a React + Firebase multi-module web application for managing aviation cargo security operations across worldwide branch stations.

### Project Summary
A multi-module SPA with HashRouter:
- **Home Dashboard**: Cards showing bulletin preview, security level mini-map (TopoJSON), security fee chart, security pledge donut (Google Sheets CSV), global news (RSS)
- **Bulletin**: Rich text + markdown posts with CRUD, comment, translate (Gemini AI), acknowledge workflow
- **Security Level**: TopoJSON world map (read-only for all users, editable for admins), per-station threat levels with AIRPORT_COORDS (~86 airports)
- **Security Fee**: Monthly cost management per branch, admin dashboard, branch history charts
- **Document Library**: File upload with categories, download tracking, drag-and-drop
- **Security Policy & Important Links**: Reference pages
- **Settings**: Branch management, cost items, currencies

### Repository
```
GitHub:  https://github.com/Mark4mission/airzeta-security-fee-app
Branch:  main (production, deployed to Vercel + GitHub Pages)
Dev:     genspark_ai_developer (feature work → PR to main)
Vercel:  https://airzeta-security-fee-app.vercel.app
```

### Clone & Setup
```bash
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app
npm install

# Create .env (REQUIRED - not in git)
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
VITE_GEMINI_API_KEY=<your-gemini-api-key>
EOF

npm run dev    # Dev server on port 5173
npm run build  # Production build -> dist/
npm run deploy # Build + deploy to GitHub Pages
```

### If Working in Genspark/Antigravity Sandbox
```bash
cd /home/user/webapp
git checkout main && git pull origin main
# .env should already exist; create if missing (see above)
```

### Tech Stack
- **React 19** + **Vite 7** (no TypeScript, no Redux/Zustand)
- **React Router DOM** ^7.13.1 with **HashRouter**
- **Firebase** ^12.9.0 (Auth, Firestore, Storage)
- **Google Gemini AI** (`@google/genai`, gemini-2.5-flash-lite) for translations
- **topojson-client** ^3.1.0 for world map rendering
- **react-quill-new** ^3.8.3 for rich text editor
- **DOMPurify** ^3.3.1 for XSS protection
- **lucide-react** ^0.562.0 for icons
- **Inline CSS** for all styling (`style={{}}`, `COLORS` constant per component)
- **Deployment**: Vercel (auto from main) + GitHub Pages (`npm run deploy`)

### File Structure
```
src/
  App.jsx                              # Root: HashRouter, AuthContext provider
  core/AuthContext.jsx                  # Firebase auth context
  core/PortalLayout.jsx                # Sidebar nav, responsive layout
  modules/
    home/HomePage.jsx                  # Dashboard (mini-map, chart, pledge, news)
    home/components/GlobalSecurityNews.jsx
    bulletin/BulletinPage.jsx          # Router wrapper
    bulletin/pages/                    # BulletinDashboard, PostDetail, PostEdit, PostWrite
    security-level/SecurityLevelPage.jsx  # World map + branch editor
    security-fee/SecurityFeePage.jsx   # Fee management
    security-fee/components/           # AdminDashboard, BranchCostHistory
    document-library/DocumentLibraryPage.jsx
    document-library/pages/            # Dashboard, Detail, Edit, Upload
    security-policy/SecurityPolicyPage.jsx
    important-links/ImportantLinksPage.jsx
    settings/SettingsPage.jsx
  firebase/config.js, auth.js, collections.js
  components/                          # Legacy: Login, BranchSelection, Settings, UserManagement
public/
  countries-110m.json                  # TopoJSON world map (~50KB)
```

### Firestore Collections
| Collection | Doc ID | Key Fields |
|-----------|--------|------------|
| `branchCodes` | Branch name | branchName, manager, currency, paymentMethod, active |
| `securityCosts` | Auto-gen | branchName, targetMonth, items[], totalEstimated, totalActual |
| `users` | Auth UID | email, role (hq_admin/branch_user), branchName |
| `settings/appSettings` | Fixed | costItems[], currencies[], paymentMethods[] |
| `securityLevels` | Branch name | branchName, levels, activeLevel, airportCode, history, guidelines |
| `bulletins` | Auto-gen | title, content, category, acknowledgements, comments, viewCount |
| `documentLibrary` | Auto-gen | title, category, fileUrl, downloadCount |

### User Roles
- `hq_admin`: Full access — all modules, edit any station, manage users
- `branch_user`: Dashboard (read-only map), bulletins, own station edit, fee submission, document view

### Key Architecture Details
1. **World Map**: `topojson-client` parses `/public/countries-110m.json` at runtime. `AIRPORT_COORDS` in SecurityLevelPage.jsx maps ~86 IATA codes → {lat, lng, city}. `MINI_AIRPORT_COORDS` in HomePage.jsx maps same codes → {lat, lng} for dashboard card.
2. **Security Pledge**: CSV fetch from Google Sheets (ID: `1rAN--sDV6dj9N5fgB71y7NoUyjgfkOHnmyAoBRiuHIw`). Filters test entries. Shows total valid submissions as donut chart.
3. **Bulletin Editor**: react-quill-new with markdown toggle. All `dangerouslySetInnerHTML` wrapped in `DOMPurify.sanitize()`.
4. **Document Library**: Firebase Storage (`document_library/` path), 100MB limit, drag-and-drop upload, download logging.
5. **AI Translation**: Gemini 2.5 Flash Lite for 10 languages (ko/en/ja/zh/de/fr/es/ar/th/vi).

### Critical Rules
1. **Build before commit**: `npm run build` must show 0 errors
2. **Inline CSS only**: `style={{}}` with `COLORS` constant — no Tailwind/CSS classes
3. **DOMPurify**: Every `dangerouslySetInnerHTML` MUST use `DOMPurify.sanitize()`
4. **AIRPORT_COORDS**: Update BOTH SecurityLevelPage.jsx AND HomePage.jsx when adding airports
5. **Currency**: Use `branch.currency`, NEVER `currentUser.preferredCurrency`
6. **Korean comments**: Preserve all Korean comments in code
7. **Firestore**: Avoid compound indexes; use single-field query + client filter
8. **Post-submit**: Wait 1.5s+ after `serverTimestamp()` before re-query
9. **Document Library drag-drop**: Only the drop zone div should have drag handlers, NOT the `<form>` element

### Test Accounts
```
Admin: mark4mission@gmail.com (hq_admin)
Branch: bkksu@test.airzeta.com / Test1234! (BKKSU, THB)
Branch: alasu@test.airzeta.com / Test1234! (ALASU, USD)
```

### Development Workflow
```bash
git checkout main && git pull origin main
git checkout -B genspark_ai_developer origin/main
# ... make changes ...
npm run build                    # VERIFY 0 errors
git add -A && git commit -m "type(scope): description"
git push -f origin genspark_ai_developer
gh pr create --base main --head genspark_ai_developer --title "..." --body "..."
# After merge:
git checkout main && git pull
npm run deploy                   # GitHub Pages
# Vercel auto-deploys from main
```

### Restoring from Backup
```bash
# From git tag:
git checkout backup-2026-03-03-v10-session10
npm install && # create .env as above

# From archive:
tar -xzf airzeta_backup_2026-03-03_session10.tar.gz
cd webapp && npm install && # create .env
```

### Current State (2026-03-03, Session 10)
- **PROJECT_GUIDE.md**: v1.8
- **Build**: 0 errors, 2,543 modules, ~15s
- **Last PR**: #60
- **All modules functional**, DOMPurify applied, ANC airport added
- **Known optimization**: Large JS chunk (~1.3MB) — consider code splitting
- Read `PROJECT_GUIDE.md` for complete changelog (Sessions 1-10), troubleshooting, and all architecture details

## PROMPT END
