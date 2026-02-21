# Air Zeta Security Fee App - Complete Project Documentation

> **Last Updated**: 2026-02-21 (backup tag: `backup-2026-02-21-v6-final-docs`)
> **Total PRs Merged**: #1 ~ #23
> **Total Source Lines**: ~6,610 lines across 14 source files + 1 seed script
> **Live URL**: https://mark4mission.github.io/airzeta-security-fee-app/

---

## 1. Project Overview

### What Is This App?
**Branch Security Cost Submission** is an internal web application for **Air Zeta** (an aviation/logistics company) that allows branch offices worldwide to submit, track, and manage their monthly security-related expenses. The HQ administrator oversees all branches from a centralized dashboard.

### Core Purpose
- Branch users submit **Estimated Costs** (budget) and **Actual Costs** (real expenses) for security items each month
- HQ admin reviews all branch submissions in a dashboard with monthly grid view
- Supports **multi-currency** operations with **KRW exchange rate** conversion for HQ reporting
- Tracks cost variance (Estimated vs Actual) with visual indicators

### Live URL
- **Production**: https://mark4mission.github.io/airzeta-security-fee-app/
- Deployed via **GitHub Pages** using `gh-pages` npm package

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 19.2.0 |
| **Build Tool** | Vite | 7.2.4 |
| **Backend/DB** | Firebase Firestore | 12.9.0 |
| **Auth** | Firebase Authentication | (bundled with firebase) |
| **Icons** | Lucide React | 0.562.0 |
| **Deployment** | GitHub Pages | via `gh-pages` 6.3.0 |
| **Styling** | Inline CSS (no Tailwind/CSS modules) | - |

### Key Design Decisions
- **No backend server** - Pure client-side React + Firebase
- **No CSS framework** - All styling via inline `style={{}}` objects with `COLORS` constant
- **No React Router** - Single-page with conditional rendering based on auth state
- **No state management library** - Pure `useState` / `useEffect` / `useCallback`
- **No TypeScript** - Plain JSX
- **Korean comments** - Many code comments are intentionally in Korean (한국어)

---

## 3. Repository & Deployment

### GitHub Repository
```
Repository: Mark4mission/airzeta-security-fee-app
URL:        https://github.com/Mark4mission/airzeta-security-fee-app
Branch:     main (production)
Dev Branch: genspark_ai_developer (feature development)
```

### Git Workflow
1. Create/switch to `genspark_ai_developer` branch from latest `main`
2. Make changes, verify build passes (`npm run build`)
3. Commit with descriptive messages, push to remote
4. Create PR to `main`
5. Deploy with `npm run deploy` (builds + publishes to `gh-pages` branch)
6. Merge PR

### Deployment Commands
```bash
npm run build      # Vite production build -> dist/
npm run deploy     # Build + publish dist/ to GitHub Pages
npm run dev        # Local development server (port 5173)
```

### Backup Tags (chronological order)
```
backup-before-pr13
backup-2026-02-21-hq-admin-approval
backup-2026-02-21-v2-variance-indicator
backup-2026-02-21-v3-pre-krw-fix
backup-2026-02-21-v4-pre-krw-currency-fix
backup-2026-02-21-v5-final-manager-sync
backup-2026-02-21-v6-final-docs              <-- LATEST
```

To restore from a tag:
```bash
git checkout backup-2026-02-21-v6-final-docs
# or create a branch from it:
git checkout -b restore-branch backup-2026-02-21-v6-final-docs
```

### Backup Archive
- Local: `/home/user/airzeta_backup_2026-02-21_v6_final.tar.gz` (145 KB)
- Contains all source, configs, scripts, docs (excludes node_modules, dist, .git)
- To restore: `tar -xzf airzeta_backup_2026-02-21_v6_final.tar.gz -C <target-dir>`

---

## 4. Firebase Configuration

### Project Details
```
Project ID:          airzeta-security-system
Auth Domain:         airzeta-security-system.firebaseapp.com
Storage Bucket:      airzeta-security-system.firebasestorage.app
Messaging Sender ID: 803391050005
App ID:              1:803391050005:web:b79b059aad13ddeaf5591c
```

### Environment Variables
The app uses Vite environment variables (`.env` file, **not committed to git**):
```env
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
```

> **IMPORTANT**: These values are also hardcoded in `scripts/seed-test-data.mjs` for seeding. The `.env` file is git-ignored. When setting up a new dev environment, create `.env` in the project root with the above values.

### Firestore Collections

#### `branchCodes` (Branch Settings)
Document ID = branch name (e.g., `BKKSU`)
```json
{
  "branchName": "BKKSU",
  "manager": "Pimchanok Srisai",
  "currency": "THB",
  "paymentMethod": "Cash",
  "active": true,
  "updatedAt": "<server_timestamp>"
}
```

#### `securityCosts` (Submitted Cost Data)
Auto-generated document IDs
```json
{
  "branchName": "BKKSU",
  "managerName": "Pimchanok Srisai",
  "targetMonth": "2026-01",
  "currency": "THB",
  "krwExchangeRate": 38.5,
  "items": [
    {
      "item": "Security Personnel Wages",
      "unitPrice": 324880.64,
      "quantity": 6,
      "estimatedCost": 1949283.84,
      "actualCost": 1949288,
      "currency": "THB",
      "paymentMethod": "Cash",
      "notes": ""
    }
  ],
  "totalEstimated": 1949283.84,
  "totalActual": 1949288,
  "submittedAt": "<server_timestamp>",
  "submittedBy": "user@example.com"
}
```

#### `users` (User Profiles)
Document ID = Firebase Auth UID
```json
{
  "email": "user@example.com",
  "role": "branch_user",
  "branchName": "BKKSU",
  "displayName": "Test User",
  "preferredCurrency": "THB",
  "preferredPaymentMethod": "Cash",
  "createdAt": "<timestamp>",
  "lastLogin": "<timestamp>"
}
```

#### `settings/appSettings` (Global App Settings)
Single document
```json
{
  "costItems": [
    { "name": "Security Personnel Wages", "category": "Labor", "description": "..." },
    { "name": "Equipment Maintenance", "category": "Equipment", "description": "..." }
  ],
  "currencies": ["USD", "EUR", "KRW", "JPY", "SGD", "HKD", "THB"],
  "paymentMethods": ["Bank Transfer", "Credit Card", "Cash", "Check", "Online Payment"],
  "updatedAt": "<timestamp>"
}
```

### Firebase Auth Settings
- **Email/Password** authentication enabled
- **Google Sign-In** enabled (requires domain authorization)
- Authorized domains: `airzeta-security-system.firebaseapp.com`, `mark4mission.github.io`

### Firebase Console Links
- **Firestore**: https://console.firebase.google.com/project/airzeta-security-system/firestore
- **Authentication**: https://console.firebase.google.com/project/airzeta-security-system/authentication
- **GCP Credentials**: https://console.cloud.google.com/apis/credentials?project=airzeta-security-system

### Test Accounts (from seed data)
```
Admin:       mark4mission@gmail.com  (hq_admin)
Branch Users: <branch>@test.airzeta.com / Test1234!
  - ALASU (Seoul, USD)
  - TYOSU (Tokyo, JPY)
  - SINSU (Singapore, SGD)
  - HKGSU (Hong Kong, HKD)
  - BKKSU (Bangkok, THB)
  - SFOSF (San Francisco, USD)
```

---

## 5. File Structure

```
/home/user/webapp/
├── index.html                    # HTML entry point
├── package.json                  # Dependencies & scripts
├── package-lock.json             # Lock file (~337 KB)
├── vite.config.js                # Vite config (base: '/', host: 0.0.0.0)
├── postcss.config.js             # PostCSS (autoprefixer)
├── eslint.config.js              # ESLint config
├── vercel.json                   # Legacy Vercel config (unused, kept for reference)
├── .gitignore                    # Git ignore rules
├── .env                          # Firebase keys (NOT in git, must create manually)
│
├── scripts/
│   └── seed-test-data.mjs        # Test data seeder (532 lines)
│
├── src/
│   ├── main.jsx                  # React entry point (10 lines)
│   ├── App.jsx                   # Main app component (1,498 lines)
│   ├── App.css                   # Global styles + spinner animation (105 lines)
│   ├── index.css                 # Root CSS reset (10 lines)
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── Login.jsx             # Login/Register/Forgot password (632 lines)
│   │   ├── BranchSelection.jsx   # First-time branch selection (479 lines)
│   │   ├── AdminDashboard.jsx    # Monthly cost grid for admin (284 lines)
│   │   ├── BranchCostHistory.jsx # Bar chart + table per branch (413 lines)
│   │   ├── Settings.jsx          # Admin settings modal (1,387 lines)
│   │   └── UserManagement.jsx    # User role management (394 lines)
│   └── firebase/
│       ├── config.js             # Firebase init from .env (29 lines)
│       ├── auth.js               # Auth functions (501 lines)
│       └── collections.js        # Firestore CRUD (336 lines)
│
├── AI_HANDOFF_PROMPT.md          # Ready-to-use prompt for AI coding assistants
├── PROJECT_CONTEXT.md            # This file - complete project documentation
├── CLAUDE.md                     # Instructions for Claude / Cursor AI
├── GEMINI.md                     # Instructions for Genspark / Gemini AI
├── README.md                     # GitHub repository README
└── AVIATION_SECURITY_HUB_DEV_GUIDE.md  # Original Korean dev guide
```

### File Line Count Summary
| File | Lines | Description |
|------|-------|-------------|
| `src/App.jsx` | 1,498 | Main component - all form logic, state, submission |
| `src/components/Settings.jsx` | 1,387 | Admin settings modal (branches, items, currencies) |
| `src/components/Login.jsx` | 632 | Login, register, forgot password UI |
| `src/firebase/auth.js` | 501 | All authentication functions |
| `src/components/BranchSelection.jsx` | 479 | First-time branch picker |
| `src/components/BranchCostHistory.jsx` | 413 | Per-branch bar chart + detail table |
| `src/components/UserManagement.jsx` | 394 | User role management |
| `src/firebase/collections.js` | 336 | All Firestore CRUD operations |
| `src/components/AdminDashboard.jsx` | 284 | Monthly cost dashboard grid |
| `scripts/seed-test-data.mjs` | 532 | Test data seeder |
| **Total** | **~6,610** | |

---

## 6. App Features & User Flow

### 6.1 Authentication Flow
```
User visits app
  ├─ Not logged in → Login screen
  │   ├─ Email/Password login
  │   ├─ Google login (popup)
  │   ├─ Self-registration (new email/password account)
  │   └─ Forgot password (email reset link)
  │
  ├─ Logged in, no branch assigned → BranchSelection screen
  │   ├─ Select a branch → becomes branch_user for that branch
  │   └─ Select "HQ" → becomes pending_admin (needs HQ admin approval)
  │
  ├─ pending_admin → "Approval Pending" screen (cannot use app until approved)
  │
  ├─ branch_user → Main form (own branch only)
  │   ├─ Branch auto-selected and locked
  │   ├─ Submit Estimated/Actual costs
  │   └─ View own branch cost history
  │
  └─ hq_admin → Full access
      ├─ Admin Dashboard (all branches grid)
      ├─ Main form (select any branch)
      ├─ Settings modal (manage branches, items, currencies, payment methods)
      ├─ User Management (approve pending admins, manage roles)
      └─ View all branch cost histories
```

### 6.2 User Roles

| Role | Permissions |
|------|------------|
| `hq_admin` | View dashboard, select any branch, submit costs, manage settings, manage users, view all history, set KRW exchange rate |
| `branch_user` | View/submit costs for own branch only, view own branch history |
| `pending_admin` | Waiting for HQ admin approval (selected "HQ" during registration). Cannot access any features. |

### 6.3 Admin Dashboard (AdminDashboard.jsx)
- **Monthly grid**: Rows = branches (all active branches), Columns = months (Jan-Dec)
- Each cell shows: **E** (Estimated) / **A** (Actual) costs with color coding
- **Variance indicator**: Shows percentage difference between Est and Act with color
  - Green = Act <= Est (under budget)
  - Red = Act > Est (over budget)
- **Click a cell** → auto-populates Basic Information section below + loads cost data
- Filters: branch dropdown, year dropdown, month dropdown
- **Recent update markers**: Cells with recently submitted data show visual indicator
- Data source: `getAllSecurityCosts()` fetches entire `securityCosts` collection

### 6.4 Cost Submission Form (App.jsx - Main Component)

#### Basic Information Section
| Field | Admin | Branch User | Notes |
|-------|-------|-------------|-------|
| Branch Name | Dropdown (all branches) | Auto-set, read-only | From `settings.branches` |
| Manager Name | Auto-filled from branch settings, editable | Auto-filled, editable | **Syncs back** to `branchCodes` on submit |
| Target Month | `<input type="month">` picker | Same | Default: current month |
| KRW Exchange Rate | Editable number input | **Hidden** | Shows currency-specific label (e.g., "Enter the THB to KRW exchange rate") |

#### Cost Items Section
- Dynamic list of cost item rows (add/remove with + and trash icons)
- Per item fields:
  | Field | Description |
  |-------|-------------|
  | Cost Item | Dropdown from `settings.costItems` |
  | Currency | Dropdown, defaults to branch currency |
  | Unit Price | Number input with comma formatting |
  | Quantity | Number input |
  | Estimated Cost | **Auto-calculated**: Unit Price x Quantity (read-only except manual override) |
  | Payment Method | Dropdown from `settings.paymentMethods` |
  | Actual Cost | Number input (conditionally editable) |
  | Notes | Text input |

#### KRW Conversion Display
- When KRW Exchange Rate is entered (admin only):
  - Under Estimated Cost: shows `≈ ₩xxx,xxx` (estimated * rate)
  - Under Actual Cost: shows `≈ ₩xxx,xxx` (actual * rate)
- Currency-aware: If branch currency is KRW, no conversion needed
- Helper text dynamically shows branch currency: "Enter the THB to KRW exchange rate" for Bangkok

#### Business Rules
| Rule | Condition |
|------|-----------|
| Estimated Cost editable | Target month is current or past month |
| Actual Cost editable | After the 28th of the target month |
| Validation | At least one cost item with name + estimated cost required |
| Manager Name sync | If manager name changed from branch default, updates `branchCodes/{branchName}` on submit |

#### Auto-Load Behavior
- When branch or month changes → automatically loads previously submitted data for that combination
- Uses `getSecurityCostsByBranch(branch, month)` → returns sorted by `submittedAt` descending
- Takes the **latest** submission and pre-fills all cost items
- Falls back to empty form if no prior data exists
- Shows status message: "Previous data loaded for [branch] [month]" or "No previous data found"

#### Post-Submit Behavior
- **hq_admin**: Form resets (branch, manager cleared, cost items reset to default)
- **branch_user**: Data remains visible, then reloads from Firestore after 1.5s delay (for `serverTimestamp()` propagation)
- **BranchCostHistory** graph refreshes via key increment (`historyRefreshKey`)
- **Manager sync**: If manager name differs from stored branch data, Firestore `branchCodes` document is updated

### 6.5 Branch Cost History (BranchCostHistory.jsx)
- **Visual bar chart**: Monthly Estimated (blue) vs Actual (red/orange) costs
- **Year selector**: Current year ± 5 years
- **Summary cards**: 
  - Total Estimated (with currency symbol)
  - Total Actual (with currency symbol)
  - Total Variance (Estimated - Actual, colored green/red)
- **Detail table**: 
  - Monthly rows with Est, Act, Variance columns
  - Month-over-Month (MoM) change percentage with trend icons (↑/↓/→)
- **Currency-aware**: Uses branch's currency for display symbols
- Visible to both admin (when a branch is selected) and branch_user (always, for own branch)
- Renders only when `branchName` is set

### 6.6 Settings Modal (Settings.jsx, admin only)
Accessible via ⚙️ Settings icon in the header.

| Tab | Contents |
|-----|----------|
| **Branches** | Add/edit/delete branch offices. Fields: name, manager, currency, payment method |
| **Cost Items** | Add/edit/delete cost item definitions. Fields: name, category, description |
| **Currencies** | Add/remove supported currency codes (e.g., "USD", "THB") |
| **Payment Methods** | Add/remove payment method options (e.g., "Bank Transfer", "Cash") |
| **User Management** | Embedded UserManagement component for managing user roles and approving pending admins |

All settings are saved to both **Firestore** (`settings/appSettings` + `branchCodes` collection) and **localStorage** (as fallback/cache).

### 6.7 User Management (UserManagement.jsx, admin only)
- **View all users**: List with email, role, branch, status
- **Create new user**: Email + password + role + branch
- **Update user role**: Switch between hq_admin / branch_user
- **Toggle user status**: Active / disabled
- **Pending Admin approval**: Approve or reject users who selected "HQ" during registration
- **Delete user profile**: Remove user document from Firestore

### 6.8 Multi-Currency Support
Supported currencies with symbols:
```
USD ($), EUR (€), KRW (₩), JPY (¥), SGD (S$),
HKD (HK$), THB (฿), GBP (£), CNY (CN¥)
```
- Each branch has a **default currency** (set in Settings → Branches)
- Each cost item can have its own currency (overridable per row)
- **KRW Exchange Rate**: Admin enters rate → shows `≈ ₩` conversion under costs
- Helper text dynamically shows: "Enter the {branch_currency} to KRW exchange rate"
- **Important**: Currency display uses `branch.currency`, NOT `currentUser.preferredCurrency`

---

## 7. Key Implementation Details

### 7.1 State Management
All state is managed via React hooks in `App.jsx`:
```javascript
// Auth
currentUser, authLoading

// Form data
branchName, currency, krwExchangeRate, managerName,
targetMonth, defaultPaymentMethod, costItems[]

// Settings (from Firestore + localStorage)
settings { branches, costItems, currencies, paymentMethods }

// UI
showSettings, isSubmitting, message, autoLoadMessage, historyRefreshKey
```

### 7.2 Data Flow
```
Login → Auth listener fires → Load settings from Firestore →
  branch_user: auto-set branch from user profile → auto-load cost data
  hq_admin: wait for branch selection from dropdown or dashboard cell click → auto-load cost data

Submit → Save to securityCosts → Check manager name change → Sync manager if changed →
  hq_admin: reset form (branch/manager cleared)
  branch_user: keep data visible, reload from Firestore after 1.5s delay

Dashboard cell click → Set branchName + targetMonth → triggers auto-load useEffect
Graph refresh: historyRefreshKey increments → BranchCostHistory key changes → component remounts
```

### 7.3 Currency Logic (Critical - Source of Past Bugs)
- `currency` state = branch-level default currency (from `branch.currency`, NOT from `preferredCurrency`)
- Admin useEffect (line ~236) and branch_user useEffect (line ~218) both use `branch.currency || 'USD'` directly
- `preferredCurrency` from user profile is **intentionally NOT used** for the main currency display
- This was a major bug source: using `preferredCurrency` caused BKK to show '$' instead of '฿'
- Each cost item row also has its own `currency` field that can differ from the branch default

### 7.4 Number Formatting
- Display: `toLocaleString('en-US')` with comma separators
- Input: Strip commas on focus (`stripCommas`), format on blur (`formatInputDisplay`)
- KRW conversion: `amount * exchangeRate` displayed as `≈ ₩{formatted_integer}` using `formatNumberInt`

### 7.5 Manager Name Synchronization (PR #22)
- On form submit, compares entered `managerName` with `settings.branches[selectedBranch].manager`
- If different: calls `updateBranchManager(branchName, managerName)` to update `branchCodes/{branchName}`
- Also updates local `settings` state immediately so next branch selection shows updated name
- Logs the sync operation for debugging

### 7.6 Authentication Functions (auth.js exports)
| Function | Description |
|----------|-------------|
| `loginUser(email, pw)` | Email/password sign-in, creates profile if missing |
| `logoutUser()` | Signs out from Firebase Auth |
| `registerUser(email, pw, displayName)` | Creates account + Firestore profile |
| `resetPassword(email)` | Sends password reset email |
| `changePassword(currentPw, newPw)` | Re-authenticates then updates password |
| `getCurrentUserProfile()` | Gets Firestore user doc by UID |
| `updateUserBranch(uid, branchName, role)` | Sets user's branch + role |
| `updateUserPreferences(uid, prefs)` | Updates currency/payment preferences |
| `listenToAuthChanges(callback)` | `onAuthStateChanged` wrapper with profile loading |
| `isAdmin(user)` | Checks `role === 'hq_admin'` |
| `isPendingAdmin(user)` | Checks `role === 'pending_admin'` |
| `createUser(email, pw, role, branch)` | Admin creates a new user |
| `getAllUsers()` | Fetches all user profiles |
| `updateUserRole(uid, role)` | Changes user role |
| `toggleUserStatus(uid)` | Enables/disables user |
| `getPendingAdmins()` | Gets all pending_admin users |
| `approvePendingAdmin(uid)` | Changes role to hq_admin |
| `rejectPendingAdmin(uid)` | Deletes user profile |
| `deleteUserProfile(uid)` | Removes Firestore user doc |
| `loginWithGoogle()` | Google popup sign-in |
| `initGoogleRedirectResult()` | Handle Google redirect |

### 7.7 Firestore CRUD Functions (collections.js exports)
| Function | Description |
|----------|-------------|
| `getAllBranches()` | Fetch all `branchCodes` documents |
| `getSecurityCostsByBranch(branch, month)` | Query costs for branch+month, sorted by submittedAt |
| `submitSecurityCost(data)` | Add new cost document |
| `getAllSecurityCosts()` | Fetch all cost documents (admin dashboard) |
| `getSecurityCostsByBranchYear(branch, year)` | Fetch by branch, client-side filter by year |
| `updateBranchManager(branchName, newManager)` | Update manager field in branchCodes |
| `saveSettingsToFirestore(settings)` | Save branches + app settings |
| `loadSettingsFromFirestore()` | Load branches + app settings |

---

## 8. Known Issues & Technical Debt

1. **Bundle size**: Main JS chunk is ~650KB (exceeds Vite's 500KB warning). Could benefit from code-splitting with `React.lazy()` and dynamic `import()`.
2. **No Firestore composite indexes**: `getSecurityCostsByBranchYear` uses client-side filtering to avoid composite index requirements. If data grows large, consider adding indexes.
3. **Inline styles**: All styling is inline CSS objects. Could migrate to CSS modules or Tailwind for maintainability.
4. **No automated tests**: No unit or integration tests exist. Adding Jest + React Testing Library would improve reliability.
5. **Vercel config**: `vercel.json` exists but is unused (legacy from initial Google Sheets-based deployment).
6. **vite.config.js base**: Set to `'/'`. GitHub Pages deployment works because `gh-pages` package handles the base path. The `deploy` script in package.json uses `gh-pages -d dist`.
7. **COLORS duplication**: The `COLORS` constant is duplicated across `App.jsx` and every component file. Could be extracted to a shared constants file.
8. **App.jsx size**: At 1,498 lines, the main component is large. Consider splitting into custom hooks (`useAuth`, `useCostForm`, etc.).

---

## 9. Development Environment Setup

### Prerequisites
- **Node.js** 18+ / npm 9+
- **Git** with GitHub access
- **GitHub CLI** (`gh`) for PR management (optional but recommended)
- Firebase project access (for `.env` values - provided below)

### Quick Start
```bash
# Clone repository
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app

# Install dependencies
npm install

# Create .env file with Firebase config
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyC1WRvtCRCkQbsPQ28Zjrr16kfdPIrZeYo
VITE_FIREBASE_AUTH_DOMAIN=airzeta-security-system.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=airzeta-security-system
VITE_FIREBASE_STORAGE_BUCKET=airzeta-security-system.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=803391050005
VITE_FIREBASE_APP_ID=1:803391050005:web:b79b059aad13ddeaf5591c
EOF

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

### Seeding Test Data
```bash
node scripts/seed-test-data.mjs
```
Creates 8 test users, 6 branches, and sample cost data for months 1-5 of the current year.

### Restoring from Backup Archive
```bash
# If you have the .tar.gz backup:
mkdir -p airzeta-restore && cd airzeta-restore
tar -xzf airzeta_backup_2026-02-21_v6_final.tar.gz
npm install
# Create .env with Firebase keys (see above)
npm run dev
```

### Restoring from Git Tag
```bash
git clone https://github.com/Mark4mission/airzeta-security-fee-app.git
cd airzeta-security-fee-app
git checkout backup-2026-02-21-v6-final-docs
npm install
# Create .env with Firebase keys (see above)
npm run dev
```

---

## 10. PR History (Major Features)

| PR | Title | Key Changes |
|----|-------|-------------|
| #10 | Login system overhaul | Self-registration, password reset, branch selection |
| #11 | BranchSelection redesign | Branch name buttons, alphabetical sort |
| #12 | Branch display codes | 3-char codes, auto-sync settings, number formatting |
| #13 | UI improvements | Button height, currency symbols, card layout, exchange rate icon |
| #14 | Column layout swap | Est.Cost/PaymentMethod positions, equal-width columns, user preference persistence |
| #15 | Number formatting | Commas for input fields, remove Default Rate from Settings |
| #16 | Admin auto-load | AdminDashboard integration, BranchCostHistory chart |
| #17 | Dashboard cell click | Data sync fixes, Est/Act emphasis |
| #18 | Variance indicator | Est/Act variance in dashboard cells, cell click deploy fix |
| #19 | Data loading fix | Remove Load Previous Data button, auto-load for all users, reset on logout |
| #20 | Submit + graph fix | Data disappears after submit, Cost History graph empty |
| #21 | KRW currency fix | Exchange rate helper text uses branch currency, Unicode rendering fix, post-submit data retention |
| #22 | Manager sync | Sync manager name to branchCodes on submit |
| #23 | Documentation | PROJECT_CONTEXT.md, AI_HANDOFF_PROMPT.md, CLAUDE.md, GEMINI.md, README.md |

---

## 11. Styling Conventions

### Color Constants (COLORS)
Every component defines its own `COLORS` object (duplicated pattern):
```javascript
const COLORS = {
  primary: '#1B3A7D',      // Navy blue (header, buttons, links)
  secondary: '#E94560',    // Red/pink (accent, secondary buttons)
  success: '#10b981',      // Green (success messages, under-budget)
  error: '#ef4444',        // Red (errors, over-budget)
  warning: '#f59e0b',      // Amber (warnings)
  info: '#3b82f6',         // Blue (info messages)
  background: '#f3f4f6',   // Light gray (page background)
  surface: '#ffffff',      // White (card backgrounds)
  text: {
    primary: '#1f2937',    // Dark gray (main text)
    secondary: '#6b7280',  // Medium gray (labels)
    light: '#9ca3af'       // Light gray (placeholders)
  }
};
```

### Currency Symbols (CURRENCY_SYMBOLS)
```javascript
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', KRW: '₩', JPY: '¥', SGD: 'S$',
  HKD: 'HK$', THB: '฿', GBP: '£', CNY: 'CN¥'
};
```

### Inline Style Pattern
All styling uses inline `style={{}}` objects. Example:
```jsx
<div style={{
  background: COLORS.surface,
  borderRadius: 16,
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
}}>
```

---

## 12. Common Pitfalls & Developer Notes

| Issue | Solution |
|-------|---------|
| Currency shows '$' for non-USD branch | Use `branch.currency`, NOT `currentUser.preferredCurrency` |
| Firestore compound query fails | Use single-field `where()` + client-side filtering |
| Unicode shows as raw text in JSX | Use JS expressions: `{'\u2248'}` or template literals, NOT bare `\u2248` |
| Data disappears after submit | Wait 1.5s+ for `serverTimestamp()` propagation before re-querying |
| KRW conversion shows NaN | Ensure `parseFloat(krwExchangeRate)` and `parseFloat(amount)` are valid |
| BranchCostHistory empty | Component renders only when `branchName` is truthy |
| Manager name not updating | Check `updateBranchManager()` is called after successful `submitSecurityCost()` |
| `npm run deploy` fails | Ensure GitHub auth is configured; `gh-pages` needs push access |
| Build warning 500KB | Expected; main chunk includes Firebase SDK. Can split with lazy loading. |
| Settings not persisting | Check both Firestore write and localStorage fallback |
