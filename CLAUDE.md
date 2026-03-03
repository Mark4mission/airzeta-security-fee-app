# CLAUDE.md - Claude Code / Cursor AI Instructions

> **Last Updated**: 2026-03-03 (Session 10)
> **Document Version**: 2.0

## Project: AirZeta Station Security Portal

### Quick Context
React 19 + Vite 7 + Firebase (Auth/Firestore/Storage) multi-module aviation security portal.
Modules: Home Dashboard, Bulletin, Security Level (world map), Security Fee, Document Library, Security Policy, Important Links, Settings.

**Primary Guide**: `PROJECT_GUIDE.md` (v1.8) - comprehensive architecture, changelog, troubleshooting.

### Repository
```
GitHub:  https://github.com/Mark4mission/airzeta-security-fee-app
Production branch: main
Development branch: genspark_ai_developer
Vercel (auto-deploy): https://airzeta-security-fee-app.vercel.app
GitHub Pages: npm run deploy
```

### Setup
```bash
# Clone
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

npm run dev    # Dev server (port 5173)
npm run build  # Production build -> dist/
npm run deploy # Build + deploy to GitHub Pages
```

### If Working in Genspark Sandbox
```bash
cd /home/user/webapp
git checkout main && git pull origin main
# .env should already exist; if not, create as above
```

### File Structure
```
src/
  App.jsx                           # Root router (HashRouter), auth context provider
  main.jsx                          # Vite entry point
  core/
    AuthContext.jsx                  # Firebase auth context (user, role, branchName)
    PortalLayout.jsx                # Sidebar navigation, responsive layout
  modules/
    home/
      HomePage.jsx                  # Dashboard cards (bulletin, security level mini-map,
                                    #   security fee chart, pledge donut, news)
      components/
        GlobalSecurityNews.jsx      # RSS news feed card
    bulletin/
      BulletinPage.jsx              # Router wrapper
      pages/
        BulletinDashboard.jsx       # List view with search/filter
        PostDetail.jsx              # View + comment + translate + acknowledge
        PostEdit.jsx                # Edit existing post (rich text + markdown)
        PostWrite.jsx               # New post (rich text + markdown)
    security-level/
      SecurityLevelPage.jsx         # AdminWorldMapView (TopoJSON map) + BranchUserView
                                    #   (threat level editor with AIRPORT_COORDS ~86 entries)
    security-fee/
      SecurityFeePage.jsx           # Fee management wrapper
      components/
        AdminDashboard.jsx          # Monthly cost grid
        BranchCostHistory.jsx       # Per-branch chart + history
    document-library/
      DocumentLibraryPage.jsx       # Router wrapper
      pages/
        DocumentDashboard.jsx       # Grid view with category filters
        DocumentDetail.jsx          # View + download + print
        DocumentEdit.jsx            # Edit metadata, drag-and-drop upload
        DocumentUpload.jsx          # New document upload
    security-policy/
      SecurityPolicyPage.jsx        # Policy reference page
    important-links/
      ImportantLinksPage.jsx        # External links management
    settings/
      SettingsPage.jsx              # App settings (branches, cost items, currencies)
  components/                       # Legacy components (Login, BranchSelection, Settings, etc.)
  firebase/
    config.js                       # Firebase init (reads VITE_ env vars)
    auth.js                         # Auth functions
    collections.js                  # Firestore collection references
public/
  countries-110m.json               # TopoJSON world map (~50KB, used by SecurityLevelPage & HomePage)
```

### Firestore Collections
| Collection | Doc ID | Purpose |
|-----------|--------|---------|
| `branchCodes` | Branch name | Branch settings (manager, currency, active) |
| `securityCosts` | Auto-gen | Monthly cost submissions per branch |
| `users` | Auth UID | User profiles (role, branchName) |
| `settings/appSettings` | Fixed | Cost items, currencies, payment methods |
| `securityLevels` | Branch name | Threat level, history, airportCode, guidelines |
| `bulletins` | Auto-gen | Posts with content, acknowledgements, comments |
| `documentLibrary` | Auto-gen | Document metadata, file references |

### User Roles
| Role | Access |
|------|--------|
| `hq_admin` | Full access to all modules, can edit any station, manage users |
| `branch_user` | View dashboard + map (read-only), edit own station, view bulletins, submit fees |

### Key Technical Details

**Styling**: All inline CSS via `style={{}}`. Each component defines a `COLORS` constant (dark navy theme). No Tailwind classes, no CSS modules.

**Routing**: HashRouter in App.jsx. Module routes: `/bulletin/*`, `/security-level`, `/security-fee`, `/document-library/*`, `/security-policy`, `/important-links`, `/settings`.

**World Map**: Uses `topojson-client` to parse `/public/countries-110m.json`. Both `AdminWorldMapView` (full page) and `SecurityLevelMiniMap` (home card) load TopoJSON at runtime. The mini-map uses `MINI_AIRPORT_COORDS` (lat/lng only), the full map uses `AIRPORT_COORDS` (lat/lng/city).

**Security Pledge**: Fetches CSV from Google Sheets (`1rAN--sDV6dj9N5fgB71y7NoUyjgfkOHnmyAoBRiuHIw`). Filters out test entries (names containing "테스트" or "test"). Counts all valid rows as total submissions. Shows recent 30-day signers.

**XSS Protection**: All `dangerouslySetInnerHTML` usages in bulletin module are wrapped with `DOMPurify.sanitize()`.

**Translations**: Google Gemini AI (`gemini-2.5-flash-lite`) via `@google/genai` for bulletin content translation.

### Critical Rules
1. **Build before commit**: Always `npm run build` to verify 0 errors
2. **Inline CSS only**: No external CSS classes
3. **Korean comments**: Preserve existing Korean comments
4. **Currency from branch**: Use `branch.currency`, never `currentUser.preferredCurrency`
5. **Firestore queries**: Avoid compound indexes; use single-field queries + client filter
6. **Unicode in JSX**: Use template literals `` {`≈ ₩${value}`} ``
7. **Post-submit timing**: Wait 1.5s+ after `serverTimestamp()` before re-query
8. **DOMPurify**: Any new `dangerouslySetInnerHTML` MUST use `DOMPurify.sanitize()`
9. **AIRPORT_COORDS**: When adding new airports, update BOTH `AIRPORT_COORDS` in SecurityLevelPage.jsx AND `MINI_AIRPORT_COORDS` in HomePage.jsx
10. **TopoJSON**: The `/public/countries-110m.json` file must exist for map rendering

### Git Workflow
```bash
git checkout main && git pull origin main
git checkout -B genspark_ai_developer origin/main
# make changes
npm run build          # VERIFY: 0 errors
git add -A && git commit -m "type(scope): description"
git push -f origin genspark_ai_developer
gh pr create --base main --head genspark_ai_developer --title "..." --body "..."
# after PR merge:
git checkout main && git pull origin main
npm run deploy         # GitHub Pages
# Vercel auto-deploys from main
```

### Test Accounts
```
Admin: mark4mission@gmail.com (hq_admin)
Branch: bkksu@test.airzeta.com / Test1234! (BKKSU, THB)
Branch: alasu@test.airzeta.com / Test1234! (ALASU, USD)
```

### Backup & Restore
```bash
# From git (latest backup tag):
git checkout backup-2026-03-03-v10-session10

# From archive (if available on AI Drive):
tar -xzf airzeta_backup_2026-03-03_session10.tar.gz
cd webapp && npm install
# Create .env as above
```

### Current State (2026-03-03)
- **Version**: PROJECT_GUIDE.md v1.8
- **Last PR**: #60 (Session 10 - ANC airport, DOMPurify, final deploy)
- **Build**: 0 errors, 2,543 modules, 15s
- **All modules functional**: Home dashboard, Bulletin (CRUD + translate + acknowledge), Security Level (world map for all users, edit for admins), Security Fee, Document Library, Security Policy, Important Links, Settings
- **Security**: DOMPurify on all innerHTML, Firebase env vars, no hardcoded secrets
- **Known**: Large JS chunk (~1.3MB) - consider code splitting for future optimization
