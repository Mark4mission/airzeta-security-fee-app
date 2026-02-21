# Air Zeta Security Fee App - Project Context

> **Last Updated**: 2026-02-21 (backup tag: `backup-2026-02-21-v5-final-manager-sync`)
> **Total PRs Merged**: #1 ~ #22
> **Total Source Lines**: ~6,078 lines across 14 source files

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
- **No CSS framework** - All styling via inline `style={{}}` objects
- **No React Router** - Single-page with conditional rendering based on auth state
- **No state management library** - Pure `useState` / `useEffect` / `useCallback`

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
1. Create/switch to `genspark_ai_developer` branch
2. Make changes, commit with descriptive messages
3. Push to remote, create PR to `main`
4. Deploy with `npm run deploy` (builds + publishes to `gh-pages` branch)
5. Merge PR

### Deployment Commands
```bash
npm run build      # Vite production build -> dist/
npm run deploy     # Build + publish dist/ to GitHub Pages
npm run dev        # Local development server (port 5173)
```

### Backup Tags (in chronological order)
```
backup-before-pr13
backup-2026-02-21-hq-admin-approval
backup-2026-02-21-v2-variance-indicator
backup-2026-02-21-v3-pre-krw-fix
backup-2026-02-21-v4-pre-krw-currency-fix
backup-2026-02-21-v5-final-manager-sync     <-- LATEST
```

To restore from a tag:
```bash
git checkout backup-2026-02-21-v5-final-manager-sync
# or create a branch from it:
git checkout -b restore-branch backup-2026-02-21-v5-final-manager-sync
```

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
  "updatedAt": "<timestamp>"
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
  "role": "branch_user",          // or "hq_admin" or "pending_admin"
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

### Test Accounts (from seed data)
```
Admin:       mark4mission@gmail.com  (hq_admin)
Branch Users: <branch>@test.airzeta.com / Test1234!
  - ALASU (USD), TYOSU (JPY), SINSU (SGD)
  - HKGSU (HKD), BKKSU (THB), SFOSF (USD)
```

---

## 5. File Structure

```
/home/user/webapp/
├── index.html                    # Entry point
├── package.json                  # Dependencies & scripts
├── vite.config.js                # Vite config (base: '/', host: 0.0.0.0)
├── postcss.config.js             # PostCSS (autoprefixer)
├── eslint.config.js              # ESLint config
├── vercel.json                   # Legacy Vercel config (unused)
├── .gitignore
├── .env                          # Firebase keys (NOT in git)
├── scripts/
│   └── seed-test-data.mjs        # Test data seeder
├── src/
│   ├── main.jsx                  # React entry point
│   ├── App.jsx                   # Main app component (~1,498 lines)
│   ├── App.css                   # Global styles + animations
│   ├── index.css                 # Root CSS reset
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── Login.jsx             # Login/Register/Forgot password
│   │   ├── BranchSelection.jsx   # First-time branch selection
│   │   ├── AdminDashboard.jsx    # Monthly cost grid (admin)
│   │   ├── BranchCostHistory.jsx # Bar chart + table per branch
│   │   ├── Settings.jsx          # Admin settings modal
│   │   └── UserManagement.jsx    # User role management
│   └── firebase/
│       ├── config.js             # Firebase init (env vars)
│       ├── auth.js               # Auth functions (~501 lines)
│       └── collections.js        # Firestore CRUD (~336 lines)
└── dist/                         # Build output (git-ignored)
```

---

## 6. App Features & User Flow

### 6.1 Authentication Flow
```
User visits app
  ├─ Not logged in → Login screen
  │   ├─ Email/Password login
  │   ├─ Google login (popup)
  │   ├─ Self-registration (new account)
  │   └─ Forgot password (email reset)
  │
  ├─ Logged in, no branch assigned → BranchSelection screen
  │   ├─ Select a branch → branch_user
  │   └─ Select "HQ" → pending_admin (needs approval)
  │
  ├─ pending_admin → "Approval Pending" screen
  │
  ├─ branch_user → Main form (own branch only)
  │
  └─ hq_admin → Admin Dashboard + Main form (any branch)
```

### 6.2 User Roles

| Role | Can Do |
|------|--------|
| `hq_admin` | View dashboard, select any branch, submit costs, manage settings, manage users, view all history |
| `branch_user` | View/submit costs for own branch only, view own branch history |
| `pending_admin` | Waiting for HQ admin approval (selected "HQ" during registration) |

### 6.3 Admin Dashboard (AdminDashboard.jsx)
- **Monthly grid**: Rows = branches, Columns = months (Jan-Dec)
- Each cell shows: **E** (Estimated) / **A** (Actual) costs with color coding
- **Variance indicator**: Shows percentage difference between Est and Act
- **Click a cell** → auto-populates Basic Information + loads cost data below
- Filter by branch, year, month
- **Recent update markers** for newly submitted data

### 6.4 Cost Submission Form (App.jsx)
**Basic Information section:**
- Branch Name (admin: dropdown, branch_user: auto-set)
- Manager Name (auto-filled from branch settings, editable)
- Target Month (date picker, `<input type="month">`)
- KRW Exchange Rate (admin only, for currency conversion display)

**Cost Items section:**
- Dynamic list of cost line items
- Per item: Cost Item (dropdown), Currency, Unit Price, Quantity, Payment Method
- Auto-calculated: Estimated Cost = Unit Price x Quantity
- Actual Cost (editable only after 28th of the month)
- KRW conversion display: `≈ ₩xxx,xxx` under Est/Act when exchange rate is set
- Notes field per item

**Business Rules:**
- Estimated Cost: Only editable for current or past months
- Actual Cost: Only editable after the 28th of the target month
- Validation: At least one cost item with name + cost required
- **Manager Name sync**: If admin changes manager name and submits, the branch's manager is updated in Firestore `branchCodes` collection

### 6.5 Branch Cost History (BranchCostHistory.jsx)
- Bar chart showing monthly Estimated vs Actual costs
- Year selector (current year ± 5)
- Summary cards: Total Estimated, Total Actual, Variance
- Detail table with MoM (Month-over-Month) change percentages
- Visible to both admin (when branch selected) and branch_user

### 6.6 Auto-Load Behavior
- When branch or month changes → automatically loads previously submitted data for that combination
- Uses `getSecurityCostsByBranch(branch, month)` query
- Falls back to empty form if no prior data exists
- After submit: branch_user data reloads after 1.5s delay (for serverTimestamp sync)

### 6.7 Settings Modal (Settings.jsx, admin only)
- **Branches**: Add/edit/delete branch offices (name, manager, currency, payment method)
- **Cost Items**: Add/edit/delete cost item definitions
- **Currencies**: Manage supported currency list
- **Payment Methods**: Manage payment method options
- All settings saved to both Firestore and localStorage

### 6.8 Multi-Currency Support
Supported currencies with symbols:
```
USD ($), EUR (€), KRW (₩), JPY (¥), SGD (S$),
HKD (HK$), THB (฿), GBP (£), CNY (CN¥)
```
- Each branch has a default currency
- Each cost item can have its own currency
- KRW Exchange Rate: Admin enters rate → shows `≈ ₩` conversion under costs
- Helper text dynamically shows: "Enter the {branch_currency} to KRW exchange rate"

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
  branch_user: auto-set branch → auto-load cost data
  hq_admin: wait for branch selection → auto-load cost data

Submit → Save to securityCosts → Sync manager if changed →
  hq_admin: reset form
  branch_user: reload data after 1.5s delay

Graph refresh: historyRefreshKey increments → BranchCostHistory remounts
```

### 7.3 Currency Logic
- `currency` state = branch-level default currency (from `branch.currency`, NOT from `preferredCurrency`)
- Admin useEffect and branch_user useEffect both use `branch.currency || 'USD'` directly
- `preferredCurrency` from user profile is intentionally NOT used for the main currency (was causing bugs where THB branches showed USD)

### 7.4 Number Formatting
- Display: `toLocaleString('en-US')` with comma separators
- Input: Strip commas on focus, format on blur
- KRW conversion: `amount * exchangeRate` displayed as `≈ ₩{formatted_integer}`

---

## 8. Known Issues & Technical Debt

1. **Bundle size**: Main JS chunk is ~650KB (exceeds Vite's 500KB warning). Could benefit from code-splitting.
2. **No Firestore indexes**: `getSecurityCostsByBranchYear` uses client-side filtering to avoid composite index requirements.
3. **Inline styles**: All styling is inline CSS objects. Could migrate to CSS modules or Tailwind for maintainability.
4. **No automated tests**: No unit or integration tests exist.
5. **Vercel config**: `vercel.json` exists but is unused (legacy from initial deployment).
6. **vite.config.js base**: Set to `'/'` for Vercel compatibility. GitHub Pages deployment works because `gh-pages` handles the base path.

---

## 9. Development Environment Setup

### Prerequisites
- Node.js 18+ / npm 9+
- Git
- Firebase project access (for `.env` values)

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
Creates 8 test users, 6 branches, and sample cost data for months 1-5.

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
| #19 | Data loading fix | Remove Load Previous Data button, fix loading for all users, reset on logout |
| #20 | Submit + graph fix | Data disappears after submit, Cost History graph empty |
| #21 | KRW currency fix | Exchange rate helper text, Unicode rendering, post-submit data retention |
| #22 | Manager sync | Sync manager name to branchCodes on submit |
