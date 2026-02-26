# AIRZETA Station Security System - User Manual
**Version 2.0 | Last Updated: 2026-02-26**

---

## Table of Contents
1. [Login & Authentication](#1-login--authentication)
2. [Home Dashboard](#2-home-dashboard)
3. [Security Bulletin Board](#3-security-bulletin-board)
4. [Security Fee Management](#4-security-fee-management)
5. [Aviation Security Level](#5-aviation-security-level)
6. [Settings & User Management](#6-settings--user-management)
7. [Global Cargo Security News](#7-global-cargo-security-news)

---

## 1. Login & Authentication

### Sign In
- **Email**: Enter your registered email address.
- **Password**: Enter your password (min 6 characters).
- Click **Sign In** to access the system.

### Sign Up (New User)
- Click **Sign Up** on the login screen.
- **Full Name**: Your display name (optional).
- **Email Address**: A valid email (required).
- **Password**: At least 6 characters (required).
- **Confirm Password**: Re-enter the password.
- After sign-up, you will be directed to **Branch Selection**.

### Branch Selection
- Select your assigned station from the dropdown.
- Selecting **HQ** requests admin approval (pending_admin status).
- Branch users can only access data for their assigned station.

### Google Sign-In
- Click **Continue with Google** on the login screen.
- Requires domain authorization in Firebase Console.

### Forgot Password
- Click **Forgot password?** on the sign-in form.
- Enter your email to receive a password reset link.

---

## 2. Home Dashboard

### Welcome Banner
- Displays your name, role badge (HQ Administrator / Station), and current date.
- **Time Zone Info**: Shows current time in UTC, KST (Korea), and your local timezone.

### Module Cards
- **Security Bulletin Board** (Active): Click to manage security announcements.
- **Security Fee Management** (Active): Click to manage station costs.
- **Aviation Security Level** (Planned): Future module for threat level management.

### Global Cargo Security News
- AI-curated news from aviation cargo security sources.
- Refreshed daily; cached in Firestore for fast loading.
- Admin users can click **Refresh** to manually fetch latest news.
- Cards show: region badge, English headline, Korean summary, date, and article link.
- Right side shows article image (or fallback icon if unavailable).
- **CRITICAL** badge appears on high-risk news items.

---

## 3. Security Bulletin Board

### Dashboard
- Lists all security bulletins sorted by newest first.
- Each post shows: title, author, date, and category badge.
- Click a post title to view the full post.

### Writing a Post (Admin only)
- Click **Write Post** button.
- **Title**: Required, descriptive headline.
- **Category**: Select from predefined categories (e.g., [HQ], [Notice]).
- **Content**: Rich text editor (Quill) supporting bold, italic, lists, links.
- **Attachments**: Upload supporting documents.
- Click **Submit** to publish.

### Editing / Deleting (Admin only)
- Open a post and click **Edit** or **Delete**.
- Editing preserves the original creation date.

---

## 4. Security Fee Management

### For Branch Users

#### Submitting Monthly Costs
- Select the **Target Month** (YYYY-MM format).
- **Estimated Cost**: Enter projected security cost for the month.
  - Editable for current and past months.
- **Actual Cost**: Enter actual cost after the 28th of the target month.
- **Currency**: Automatically set from your branch settings.
- **Payment Method**: Select from configured options.
- **Manager Name**: Auto-filled from branch settings; synced on submit.
- Click **Submit** to save.

#### Viewing Cost History
- Select **Target Year** to view annual cost data.
- Table shows: month, estimated cost, actual cost, variance, status.

### For Admin (HQ)

#### Admin Dashboard
- Overview of all stations' cost submissions.
- Filter by branch, month, or year.
- **Export**: Download data as a report.
- **Delete**: Remove specific branch/month cost entries.

#### Exchange Rate Management
- Upload an Excel file with monthly exchange rates.
- Rates are applied to calculate KRW equivalents.
- View uploaded rates by selecting the target year.

#### Contract File Management
- Upload contract documents (PDF) per branch per year.
- Files are stored in Firestore using chunk splitting (supports files up to ~5MB).
- View or download existing contracts.

---

## 5. Aviation Security Level (Planned)

- **Status**: Not yet implemented.
- Future feature for managing aviation security threat levels per station.

---

## 6. Settings & User Management

### Settings (Admin only)

#### Branch Management
- Add, edit, or remove branch stations.
- Fields: Branch Name, Branch Code, Manager, Currency, Payment Method.
- Changes sync to the `branchCodes` Firestore collection.

#### Cost Items
- Configure the list of security cost categories.

#### Currencies
- Define available currencies (USD, KRW, THB, etc.).

#### Payment Methods
- Configure payment method options (Transfer, Cash, Card, etc.).

### User Management (Admin only)
- View all registered users.
- **Approve/Reject** pending admin requests.
- **Change Role**: Promote or demote user roles.
- **Activate/Deactivate**: Toggle user access.
- **Delete**: Remove a user's Firestore profile.

---

## 7. Global Cargo Security News

### How It Works
1. **RSS Feeds**: Articles are fetched from Air Cargo News, Passenger Terminal Today, AeroTime Hub, and Simple Flying via the rss2json.com API.
2. **AI Filtering**: Gemini 2.5 Flash-Lite selects 5 most relevant articles focused on:
   - Security screening (ETD, K9, CSD, X-ray)
   - Cargo security incidents and threats
   - Regulatory policy changes (ICAO, TSA, IATA)
   - Airport security operations
3. **Caching**: Results are cached in Firestore for 20 hours to minimize API calls.
4. **Display**: Cards show region badge, English headline, Korean summary, date, link, and image.

### News Card Layout
| Left 70% | Right 30% |
|-----------|-----------|
| Region badge (Global, Asia, Americas, Europe/CIS, Middle East/Africa) | Article image |
| **Bold English headline** | (aspect-video, object-cover) |
| Korean summary | Fallback: ShieldCheck or PlaneTakeoff icon |
| Date + "Read article" link | |

### Priority System
- **normal**: Standard article display.
- **critical**: Red gradient background, CRITICAL badge with AlertTriangle icon.

### Admin Controls
- **Refresh** button: Manually trigger news fetch (bypasses cache timer).

---

## Security Audit Summary (2026-02-26)

### Findings & Remediations Applied

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | CORS proxy (allorigins.win) unreliable | High | Fixed: switched to rss2json.com |
| 2 | RSS content not sanitized (XSS risk) | Medium | Fixed: sanitizeText() added |
| 3 | Login inputs missing autocomplete | Low | Fixed: autocomplete attributes added |
| 4 | Firebase config logged to console | Low | Fixed: debug log removed in production |
| 5 | No rate limiting on news refresh | Low | Acceptable: admin-only, manual action |
| 6 | Firebase API key in .env file | Info | Correct: .env in .gitignore, Vite VITE_ vars are public by design |
| 7 | Firestore security rules | Info | Managed in Firebase Console (not in repo) |

### Recommendations
1. **Firestore Rules**: Ensure `securityNews` collection allows read for authenticated users only.
2. **Gemini API Key**: Use a dedicated Gemini API key (separate from Firebase API key) in Vercel env vars.
3. **Rate Limiting**: Consider adding server-side rate limiting if scaling beyond internal use.
4. **CSP Headers**: Add Content-Security-Policy headers in Vercel config for additional XSS protection.

---

*For technical support, contact the Aviation Security Team.*
