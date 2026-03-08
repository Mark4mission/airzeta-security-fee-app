# AirZeta Security Portal - Project Guide

> **Document Version**: 2.5
> **Last Updated**: 2026-03-08
> **Project Name**: AirZeta Station Security Portal (webapp)
> **Repository**: https://github.com/Mark4mission/airzeta-security-fee-app

---

## 1. Project Overview

AirZeta Security Portal is a **React SPA (Single Page Application)** for managing aviation cargo security operations across multiple branch stations worldwide. It is used by HQ admins and branch station users.

### Purpose
- Manage security threat levels per station (with world map visualization)
- Publish and track security bulletins/directives with acknowledgement workflow
- Manage security fees and cost history
- Provide security policy references and important links
- AI-powered translation (Gemini) for multilingual operations

### Users
| Role | Description |
|------|-------------|
| `hq_admin` | Headquarters administrator - full access to all modules, can manage users and edit any station |
| `branch_user` | Branch station user - can view bulletins, manage own station's security level, upload fee data |

---

## 2. Technology Stack

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | ^19.2.0 | UI framework |
| Vite | ^7.2.4 | Build tool / dev server |
| React Router DOM | ^7.13.1 | Client-side routing (HashRouter) |
| Tailwind CSS | ^4.1.18 (PostCSS plugin) | Utility CSS |

### Backend / Services
| Service | Version | Purpose |
|---------|---------|---------|
| Firebase | ^12.9.0 | Auth, Firestore DB, Storage |
| Google Gemini AI | @google/genai ^1.43.0 | AI translation (gemini-2.5-flash model) |

### Key Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| react-quill-new | ^3.8.3 | Rich text editor for bulletins |
| lucide-react | ^0.562.0 | Icon library |
| topojson-client | ^3.1.0 | World map rendering (TopoJSON -> GeoJSON) |
| marked | ^17.0.3 | Markdown to HTML conversion |
| turndown | ^7.2.2 | HTML to Markdown conversion |
| qrcode.react | ^4.2.0 | QR code generation |
| react-to-print | ^3.3.0 | Print-to-PDF for bulletins |
| read-excel-file | ^6.0.3 | Excel file parsing for fee uploads |
| dompurify | ^3.3.1 | HTML sanitization |

### Deployment
| Platform | Method |
|----------|--------|
| **GitHub Pages** | `npm run deploy` (gh-pages package) |
| **Vercel** | Auto-deploy from main branch (vercel.json config) |
| Production URL | https://airzeta-security-fee-app.vercel.app |

---

## 3. Environment Variables

All environment variables use the `VITE_` prefix (Vite convention).

```env
VITE_FIREBASE_API_KEY=<Firebase API key>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_APP_ID=<app-id>
VITE_GEMINI_API_KEY=<Gemini AI API key from aistudio.google.com>
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<reCAPTCHA Enterprise site key (optional, enables App Check)>
```

**IMPORTANT**: The `.env` file must be in the project root. It is NOT committed to git.

---

## 4. Project Structure

```
webapp/
  public/
    countries-110m.json          # TopoJSON world map data (Natural Earth 110m)
  src/
    main.jsx                     # App entry point
    App.jsx                      # Root component with HashRouter routing
    App.css                      # Global app styles (dark theme, scrollbar, animations)
    index.css                    # Quill editor styles, bulletin content styles, print styles
    
    core/
      AuthContext.jsx             # Firebase Auth provider, role detection, branch info
      PortalLayout.jsx            # Main layout with sidebar navigation
    
    firebase/
      config.js                   # Firebase app initialization, exports firebaseApp
      auth.js                     # Auth helper functions (with security hardening)
      collections.js              # Firestore collection references
      security.js                 # Security module v2.3: App Check, rate limiting, session mgmt, audit logging (with pre-auth event queue)
      auditSchedule.js             # Security Audit Schedule Firestore helpers (NEW v2.3)
    
    components/                   # Legacy/shared components
      AdminDashboard.jsx          # (Legacy) Admin dashboard
      BranchCostHistory.jsx       # (Legacy) Branch cost history
      BranchSelection.jsx         # Branch selector dropdown
      Login.jsx                   # Login page
      Settings.jsx                # (Legacy) Settings
      UserManagement.jsx          # User management component
    
    modules/
      home/
        HomePage.jsx              # Dashboard with module cards, recent bulletins
        components/
          GlobalSecurityNews.jsx   # RSS-based global security news feed
      
      bulletin/
        BulletinPage.jsx          # Router for bulletin sub-pages
        pages/
          BulletinDashboard.jsx   # List of all directives with search, view count
          PostWrite.jsx           # New directive editor (Quill + Markdown + AI translate)
          PostEdit.jsx            # Edit directive (same features as Write)
          PostDetail.jsx          # View directive with comments, acknowledge, translate
      
      security-fee/
        SecurityFeePage.jsx       # Security fee management router
        components/
          AdminDashboard.jsx      # Admin fee overview
          BranchCostHistory.jsx   # Branch-level fee history
      
      security-level/
        SecurityLevelPage.jsx     # Security level management
                                  # Contains: BranchUserView, AdminWorldMapView
                                  # World map with IATA airport markers
                                  # Level configuration, guidelines, history
      
      security-policy/
        SecurityPolicyPage.jsx    # Security policy document viewer
      
      important-links/
        ImportantLinksPage.jsx    # Grouped important links with QR codes
      
      document-library/
        DocumentLibraryPage.jsx   # Router for document library sub-pages
        pages/
          DocumentDashboard.jsx   # List of all documents with search, filter, category badges
          DocumentUpload.jsx      # Upload new document with IATA code, category, permissions
          DocumentDetail.jsx      # View document, download files, admin download tracking
          DocumentEdit.jsx        # Edit document metadata and attachments
      
      security-audit/
        SecurityAuditSchedulePage.jsx  # Audit schedule management (admin-only) (NEW v2.3)
        AuditScheduleSettings.jsx      # Audit schedule settings panel (NEW v2.3)
      
      settings/
        SettingsPage.jsx          # App settings and user management
        SecurityDashboard.jsx     # Admin security monitoring panel (NEW v2.2)
```

---

## 5. Firestore Collections

| Collection | Purpose | Key Fields |
|-----------|---------|------------|
| `users` | User accounts | uid, email, role, branchName, displayName |
| `branchCodes` | Registered branch stations | (doc ID = branch name) |
| `bulletinPosts` | Security directives | title, content, authorId, authorName, authorRole, attachments, acknowledgedBy[], viewCount, createdAt |
| `bulletinPosts/{id}/comments` | Comments on posts | text, authorId, authorBranch, authorRole, createdAt |
| `securityLevels` | Per-station security config | branchName, levels[], activeLevel, activeSince, guidelines[], history[], **airportCode**, updatedAt, updatedBy |
| `securityCosts` | Security fee data | branchName, targetMonth, items[], submittedAt |
| `systemConfig` | System-level config (security policy content) | (doc ID = configKey, e.g. `securityPolicy`) |
| `securityPolicies` | Policy documents (legacy) | (policy content) |
| `importantLinks` | Important links | url, title, category, order |
| `documentLibrary` | Document Library (SSOP) | title, description, category, iataCode, downloadPermission, pinned, attachments[], uploaderId, uploaderEmail, uploaderBranch, uploaderRole, downloadCount, downloadLog[], createdAt, updatedAt |
| `contracts` | Branch contract files (chunk storage) | branchName, year, fileName, fileType, fileSize, totalChunks, uploadedAt |
| `contracts/{id}/chunks` | Contract file binary data chunks | data (base64 string) |
| `attachments` | Monthly attachment files (chunk storage) | branchName, yearMonth, fileName, fileType, fileSize, totalChunks, uploadedAt |
| `attachments/{id}/chunks` | Attachment file binary data chunks | data (base64 string) |
| `exchangeRates` | Monthly exchange rate tables | rates[], fileName, yearMonth, uploadedAt |
| `securityAuditLog` | Security event tracking (v2.2) | eventType, timestamp, userId, userEmail, userAgent, language, timezone, screenResolution, appCheckActive, deviceFingerprint |
| `userSecurity` | Per-user security metadata (v2.2) | lastSuccessfulLogin, lastFailedLogin, failedAttemptsSinceLastLogin, totalLogins, totalFailedLogins, lastUserAgent, lastTimezone |
| `securityAuditSchedules` | Branch security audit schedules (v2.3) | branchName, auditType, startDate, endDate, auditor, status, frequency, notes, findings, recommendations, createdBy, createdAt, updatedAt |
| `settings/appSettings` | App-wide settings | costItems[], currencies[], paymentMethods[], updatedAt |
| `settings/auditScheduleSettings` | Audit schedule configuration (v2.3) | auditTypes[], auditFrequencies[], defaultAuditors[], notificationDaysBefore, defaultAuditDuration |
| `reports` | Generated reports | (admin reports) |
| `securityNews` | Security news items | (news content, admin-managed) |

---

## 6. Key Features & Implementation Details

### 6.1 Security Level Module
- **World Map**: TopoJSON rendering via custom SVG Mercator projection centered on ICN (126°E)
- **Access Control (v1.7)**: The global world map view (`AdminWorldMapView`) is now visible to ALL logged-in users, not just admins. However:
  - **Admin users**: Can click map markers and station cards to edit any station's configuration. Tooltip shows "Click to edit configuration". Station cards show "Edit Configuration" link.
  - **Branch users**: View-only access to the global map. No click-to-edit on markers or cards. A separate "Edit My Station" button below the map navigates to their own station's `BranchUserView` editor.
  - **LESSON**: Separating read access (map viewing) from write access (station editing) via `isAdmin` prop gives all users situational awareness without compromising security controls.
- **IATA Codes**: Uses `airportCode` field (explicitly set by user) OR falls back to first 3 letters of branchName → AIRPORT_COORDS dictionary
- **Airport Code Input (v1.3)**: Each station can set an explicit IATA airport code via a text field with autocomplete dropdown from `AIRPORT_COORDS`. This solves the branch name ≠ airport code problem (e.g., "LONSF" branch → "STN" airport). Saved in `securityLevels` document as `airportCode` field.
- **AIRPORT_COORDS**: Contains 86+ airports worldwide (expanded in v1.3, v1.8 added ANC)
- **Risk Tiers**: Safe (#22c55e) / Caution (#f97316) / Alert (#ef4444)
- **History**: Level changes are recorded ONLY when "Save Configuration" is clicked (not on UI selection)
- **History Date**: Uses the "Effective Since" date field, not today's date

### 6.2 Document Library Module (NEW - v1.2, Updated v1.5)
- **Purpose**: Station Security Operation Manuals (SSOP) & reference documents
- **Firestore Collection**: `documentLibrary`
- **File Storage**: Firebase Storage under `document_library/` path
- **Upload Limit**: 100 MB per file
- **Title Format**: `[IATA Code] (Category) Document Title` - e.g. `[ICN] (Regulation) SSOP Manual v3`
- **Categories**: Regulation, Guideline, Material, General, Other (color-coded badges)
- **Visibility (v1.3)**: ALL documents are visible to ALL users in the dashboard and detail page. The file list is always shown to everyone regardless of permission.
- **Download Permission**: Radio buttons - "Admin Only" or "All Branches"
  - This controls **download ability only**, not document/file visibility
  - Uploader's branch ALWAYS has access automatically
  - Admin users ALWAYS have access
  - Users without download access see file names (grayed out with lock icon) but cannot download
- **Drag-and-Drop Download (v1.3)**: File items use `<a>` tags with `draggable="true"` and `DownloadURL` data transfer. Users can click to download or drag a file to their desktop/file manager to save it.
- **Drag-and-Drop Upload in Edit Mode (v1.5)**: Fixed by removing form-level drag event handlers. See Section 7.11 for details.
- **Pin to Top**: Admin-only checkbox; pinned documents sort above all others
- **Download Tracking**: Every download records `{userId, userEmail, branchName, fileName, downloadedAt}` in `downloadLog[]` array
  - Admin view: expandable section showing downloads grouped by branch
  - `downloadCount` field incremented on each download
- **IATA Code Selector**: Admin gets a dropdown from all registered branches; branch users see their 3-letter code auto-filled
- **Pages**: DocumentDashboard (list with search, filter by category), DocumentUpload, DocumentDetail (view + download + tracking), DocumentEdit
- **Route**: `/document-library/*` in App.jsx, navigation icon: FolderOpen

### 6.3 Bulletin Editor (PostWrite / PostEdit)
- **Rich Text**: react-quill-new (v3.8.3) wrapping Quill 2.0.3 with snow theme
- **Markdown Mode**: Toggle between rich text and markdown (marked + turndown)
- **Table Insertion**: Uses Quill 2's **native table module** (`quill.getModule('table').insertTable(rows, cols)`). The `table: true` must be in quillModules, and format names `table`, `table-row`, `table-body`, `table-container` must be in quillFormats.
- **Horizontal Rule**: Custom button injects `<hr>` tag into content state
- **Underline**: Enabled in toolbar and formats
- **Enter Key**: Custom keyboard binding inserts `\n` (line break) instead of new paragraph
- **AI Translation**: Gemini 2.5 Flash Lite for post content + individual comment translation
- **File Upload**: Firebase Storage with resumable uploads, progress bar
- **View Count**: Firestore `increment(1)` on post open

### 6.4 Comment Translation
- **Quick Buttons**: KOR, ENG, + auto-detected local language (based on timezone)
- **Per-Comment**: Each comment has its own translate buttons beside the author ID

### 6.5 Security Pledge Card (Enhanced - v1.5)
- **Google Sheets Integration**: Fetches pledge signatory data from a published Google Sheet via CSV export URL (`/gviz/tq?tqx=out:csv`)
- **Sheet ID**: `1rAN--sDV6dj9N5fgB71y7NoUyjgfkOHnmyAoBRiuHIw`
- **Name Masking**: ~1/3 of each name is replaced with asterisks for privacy (Korean 3-char: "홍*동", English: "Tae*** h**")
- **Total Count**: SVG donut chart showing unique signatory count (deduped by name, test entries excluded)
- **Recent Signers**: Lists up to 8 signers from the last 30 days with masked names and dates
- **Admin Link**: Admin users see a "View Responses" button linking to the editable Google Sheet
- **CSV Parsing**: Custom parser handles quoted fields and commas within field values
- **Privacy**: No raw personal data is displayed; all names are partially masked

### 6.6 Security Audit Schedule Module (NEW - v2.3, Enhanced v2.4)
- **Origin**: Integrated from standalone app (https://branch-security-audit.vercel.app)
- **Access**: Admin-only (`hq_admin` role). Branch users see "Access Restricted" message.
- **Route**: `/security-audit` in App.jsx, navigation icon: CalendarDays
- **Sidebar**: Appears as "Audit Schedule" menu item (visible only to admin users)
- **Theme**: Light background with dark text for improved readability (differs from portal's dark theme)
- **Features**:
  - Dashboard with statistics cards (total, scheduled, in progress, completed, overdue, branches)
  - **Annual Schedule Table** (v2.4): 12-month Gantt-style view grouped by branch with color-coded status cells, legend, today's month highlighted
  - Table view with sortable columns, inline status dropdown, edit/delete actions, zebra-striped rows
  - Calendar view with month navigation, day grid showing scheduled audits with color-coded status
  - **Inspector View** (v2.4): Cards grouped by auditor with upcoming/completed/overdue stats, schedule list with branch, dates, status
  - Create/Edit modal with branch selection, audit type, date range, auditor, status, frequency, notes, findings, recommendations
  - Year/branch/status/search filters with 4 view mode toggles (Annual, Table, Calendar, Inspector)
  - Delete confirmation modal
- **HomePage Integration** (v2.4): Upcoming Security Inspections card on Home dashboard (admin-only)
  - Two-column layout: this month & next month
  - Shows branch name, date range, auditor, status for each audit
  - Overdue audits highlighted with red border and alert icon
  - "View All" button navigates to `/security-audit`
- **Firestore Collection**: `securityAuditSchedules`
- **Status Options**: scheduled (blue), in_progress (yellow), completed (green), cancelled (red), postponed (orange)
- **Settings Integration**: Audit schedule settings panel added to Settings page (`AuditScheduleSettings` component)
  - Configurable audit types, frequencies, default auditors
  - Notification reminder days, default audit duration
  - Persisted in `settings/auditScheduleSettings` Firestore document
- **Files**:
  - `src/modules/security-audit/SecurityAuditSchedulePage.jsx` - Main page component (4 views)
  - `src/modules/security-audit/AuditScheduleSettings.jsx` - Settings panel component
  - `src/firebase/auditSchedule.js` - Firestore CRUD helpers, settings, and `getUpcomingAudits()` for HomePage

### 6.7 Routing
- Uses `HashRouter` (URLs like `/#/bulletin`, `/#/security-level`)
- This is required for GitHub Pages compatibility

---

## 7. Known Issues & Common Mistakes

### 7.1 Quill Editor Format Registration Error
**Problem**: `Cannot register "bullet" specified in "formats" config`
**Root Cause**: In `react-quill-new`, the bullet list format is registered as `'list'` (value: 'bullet'), NOT as a separate `'bullet'` format. Having `'bullet'` in the `quillFormats` array causes a registration error.
**Fix**: Only include `'list'` in quillFormats, NOT `'bullet'`.
```js
// WRONG
const quillFormats = ['list', 'bullet', ...];
// CORRECT
const quillFormats = ['list', ...];
```

### 7.2 Quill Table Support (CRITICAL - Updated 2026-03-02)
**Problem**: Earlier approach of injecting raw `<table>` HTML into content state was stripped by Quill's Delta converter, showing plain text instead of a table.
**Root Cause**: Quill re-renders content via its Delta format. Any HTML tags not registered as Quill blots are stripped when Quill processes the content.
**Fix (v1.1)**: Use Quill 2.0's **native table module**:
  1. Add `table: true` to quillModules config
  2. Add format names to quillFormats: `'table', 'table-row', 'table-body', 'table-container'`
  3. Insert tables via API: `editor.getModule('table').insertTable(rows, cols)`
  4. CSS in `index.css` styles `td[data-row]` for dark theme borders
**Previous failed approach (DO NOT USE)**: `setContent(prev => prev + tableHTML)` - Quill strips the table tags.
**Previous failed approach (DO NOT USE)**: `dangerouslyPasteHTML()` - Also stripped by Quill.
**LESSON LEARNED**: Always check if Quill has native support for a feature before trying HTML injection workarounds. Quill 2.0 has native table support via its `modules/table` module.

### 7.3 History Date vs Today's Date
**Problem**: History entries were being created with today's date on every level click, resulting in meaningless entries.
**Fix**: History entries are created ONLY during the Save operation, and use the "Effective Since" date field.

### 7.4 Underline Feature
**Problem**: Underline button was accidentally removed when cleaning up broken table/divider features.
**Fix**: Must include `'underline'` in BOTH the toolbar container array AND the quillFormats array.

### 7.5 Horizontal Rule Insertion (CRITICAL - Updated v1.2)
**Problem (v1.1)**: Inserting `<hr>` directly into content state via `setContent(prev => prev + '<hr>')` did NOT work because Quill strips unregistered HTML tags from its Delta format. HR tags appeared in edit mode but disappeared after save.
**Root Cause**: Quill's Delta converter strips HTML tags that don't have registered Blots. `<hr>` has no built-in Quill Blot.
**Fix (v1.2)**: Register a custom `DividerBlot` extending `BlockEmbed` with `tagName = 'hr'` and `blotName = 'divider'`:
```js
import ReactQuill, { Quill } from 'react-quill-new';
const BlockEmbed = Quill.import('blots/block/embed');
class DividerBlot extends BlockEmbed {
  static blotName = 'divider';
  static tagName = 'hr';
}
Quill.register(DividerBlot, true);
```
Then insert via Quill API:
```js
editor.insertEmbed(range.index + 1, 'divider', true);
```
And add `'divider'` to `quillFormats` array.
**Previous failed approach (DO NOT USE)**: `setContent(prev => prev + '<hr>')` - Quill strips the hr tag.
**LESSON LEARNED**: Any HTML element that needs to survive Quill's Delta round-trip MUST have a registered Blot.

### 7.6 Deploy Method
**Production Deploy**: `npm run deploy` (runs `gh-pages -d dist`)
- This builds first (`predeploy` script) then pushes to gh-pages branch
- Vercel auto-deploys from the main branch when PRs are merged
- **Do NOT use** `npx vercel --prod` unless a Vercel token is configured

### 7.7 Git Workflow
- Development branch: `genspark_ai_developer`
- Always rebase on `origin/main` before creating PR
- Squash commits before push: `git reset --soft HEAD~N && git commit -m "message"`
- Force push after rebase/squash: `git push -f origin genspark_ai_developer`

### 7.8 Drag-and-Drop Download (v1.3)
**Problem**: `DocumentDetail.jsx` download buttons used `<button>` elements which don't support native HTML5 drag-to-desktop.
**Root Cause**: The HTML5 drag-and-drop download feature requires:
  1. An `<a>` element (not `<button>`) with `href` and `download` attributes
  2. `draggable="true"` attribute
  3. `dataTransfer.setData('DownloadURL', 'mime:filename:url')` in `onDragStart`
**Fix**: Changed file download items from `<button>` to `<a>` tags with proper `href`, `download`, `draggable`, `onDragStart` handlers. Click still works via `onClick` with `e.preventDefault()`.
**LESSON LEARNED**: Browser drag-to-desktop downloads require the `DownloadURL` MIME type in dataTransfer, and the element must be a proper `<a>` tag.

### 7.9 Branch Name vs Airport Code Mismatch (v1.3)
**Problem**: Branch names like "LONSF" (London office) don't match IATA codes ("STN" for Stansted). The `extractIATA()` function only takes first 3 letters, yielding "LON" which isn't a valid IATA code.
**Fix**: Added an `airportCode` field to the security level form. Users can manually set their airport's 3-letter IATA code, which takes priority over the auto-extracted code. The admin world map uses `airportCode` first, then falls back to `extractIATA(branchName)`. Also expanded `AIRPORT_COORDS` from ~55 to ~85 airports.
**LESSON LEARNED**: Never assume naming conventions will be consistent across international operations. Always provide manual override fields.

### 7.10 Build Performance
**Problem**: `npm run build` (vite build) can hang/timeout in memory-constrained sandbox environments.
**Fix**: Use `NODE_OPTIONS="--max-old-space-size=512"` before build commands in sandboxed environments. The project transforms ~2,542 modules and needs careful memory management.

### 7.11 Drag-and-Drop File Upload in Edit Mode (v1.4, Corrected v1.5)
**Problem**: In `DocumentEdit.jsx`, dragging files onto the upload drop zone caused the page to "flicker" and files were never added to the newFiles state.
**Root Cause (Session 6 v1.4 - WRONG approach)**: Initially the form-level `onDragOver`/`onDragEnter`/`onDrop` handlers with `e.preventDefault()` were ADDED to the `<form>` element. This appeared to fix the browser navigation issue, but actually CAUSED another problem: the form's `onDrop` handler consumed all drop events before they could reach the inner drop zone's handler.
**Root Cause (Session 7 v1.5 - CORRECT diagnosis)**: The `<form>` element had `onDragOver={(e) => e.preventDefault()}`, `onDragEnter={(e) => e.preventDefault()}`, and `onDrop={(e) => e.preventDefault()}`. These form-level handlers intercepted ALL drag events and called `e.preventDefault()` without forwarding files to the state. Since the form wraps the drop zone, the drop event was consumed at the form level and never reached the inner drop zone's `onDrop` handler that actually adds files to `newFiles`.
**Fix (v1.5)**: REMOVED all drag event handlers (`onDragOver`, `onDragEnter`, `onDrop`) from the `<form>` element. The inner drop zone `<div>` already has its own proper event handlers with both `e.preventDefault()` and `e.stopPropagation()`, and correctly updates state via `setNewFiles(prev => [...prev, ...validFiles])`.
**LESSON LEARNED**: 
  - Drag events bubble up through the DOM. A parent element calling `preventDefault()` on `onDrop` will consume the event before any child handler can process it.
  - Only attach drag event handlers to the SPECIFIC drop target element, not to wrapper forms or containers.
  - When drag-and-drop "flickers" but doesn't actually add files, check for parent elements intercepting the events.
  - The v1.4 fix was a RED HERRING that masked the real issue. Always verify that the actual file state (`newFiles`) updates after drop, not just that the page doesn't reload.

### 7.12 Home Dashboard Card Visualizations (v1.4, Updated v1.7)
**Security Level Mini Map Enhancements**:
  - (v1.7) **Statistics legend changed to horizontal bottom bar** — spans the full width of the map at the bottom instead of a vertical box in the corner. This covers less of the map area while remaining readable. Uses flex row layout with colored dots, counts, tier labels, and total station count separated by a vertical divider
  - (v1.6) Replaced hand-drawn continent path outlines with **real TopoJSON country geometry** loaded at runtime from `/public/countries-110m.json` via `topojson-client`. This produces a detailed, accurate world map even at card size
  - (v1.6) **Removed all IATA code labels** from station markers on the mini-map for security (general users should not see which stations are registered)
  - (v1.6) Updated viewBox height from 140 to 160 for better proportions with detailed country outlines
  - (v1.6) Added `miniGeoPath()` utility that converts GeoJSON Polygon/MultiPolygon geometry to SVG `<path>` d-strings using the same Mercator projection as `miniProject()`
  - (v1.4) Added connection lines between nearby stations (diagram-like effect)
  - (v1.4) Added animated pulse rings for red (alert) level stations
  - (v1.4) Added SVG glow filters for markers by risk tier
  - (v1.4) Added "Global Status" label overlay with MapPin icon
  - All interactions are purely visual (no zoom, no click modals) to preserve security
  - **LESSON**: Using runtime TopoJSON loading (same as AdminWorldMapView) ensures the mini-map stays consistent with the full Security Level page. The ~50KB TopoJSON file is already used by the admin view, so there is no extra bundle cost

**Security Fee Mini Chart Enhancements**:
  - Added gradient area fills under both Est. and Actual lines for visual depth
  - Enhanced endpoint dots with outer glow circles
  - Improved stat summary boxes with TrendingUp icons
  - Added "sites" label to branch count displays
  - Centered and improved legend positioning

**Security Pledge Card Enhancements (v1.4)**:
  - Added decorative background elements
  - Added hover animation on QR code card
  - Added "SSI Access Required" and "Mobile Friendly" badges
  - Added separate "New Tab" link button alongside the modal button
  - Shield icon now has its own styled container

### 7.13 Google Sheets CSV Integration for Pledge Data (v1.5, Updated v1.6)
**Problem**: Need to display real-time pledge signatory data from a Google Sheet in the portal without API keys.
**Solution**: Use the public CSV export endpoint:
  - URL format: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv`
  - Returns raw CSV that can be parsed client-side with a custom parser
  - Sheet must be shared as "Anyone with the link can view"
**Name Masking**: Privacy function masks ~1/3 of each name:
  - Korean 3-char: first + asterisk + last (e.g., "홍*동")
  - Korean 2-char: first + asterisk (e.g., "김*")
  - English with space: ~66% of first name + asterisked last (e.g., "Tae*** h**")
  - Longer names: keep front + back, mask middle
**Count Logic (v1.6 FIX)**:
  - **Total count** = all valid data rows with non-empty name + valid timestamp, excluding test entries. This counts total **submissions**, not unique signers
  - Previous v1.5 logic deduped by name, showing 86 unique signers instead of total submissions
  - **Empty row filtering**: Google Sheets CSV export may return hundreds of empty trailing rows (e.g., 969 rows where only 91 have data). The parser now validates both `name.trim()` and `!isNaN(new Date(timestamp).getTime())` to skip empty/invalid rows
  - **Donut chart max value**: Based on actual valid submission count, NOT the total CSV row count
  - Recent signers list is still deduped for display (to avoid showing the same person twice)
**Filtering**: Test entries (containing "테스트" or "test") are excluded
**Data Validation (v1.7 CLARIFICATION)**:
  - Google Sheet has 91 CSV lines = 1 header + 90 data rows
  - 1 test entry ("작동 테스트") is excluded → **89 valid submissions** is the correct displayed count
  - Previous claim of "90 total" was inaccurate (included the test row). The displayed value 89 is verified correct
  - 3 people submitted twice → unique signers = 86, but the chart correctly shows total valid submissions (89)
**LESSON LEARNED**: 
  - Google Sheets CSV export via `/gviz/tq?tqx=out:csv` is a reliable zero-auth approach for reading published sheets
  - The CSV may contain commas within quoted fields, so `line.split(',')` is NOT sufficient — a proper CSV parser is needed
  - **CRITICAL**: Google Sheets CSV export includes ALL rows up to the last row ever edited, not just rows with data. Always validate each row's content before counting
  - When displaying submission counts, clarify whether the number represents unique persons or total submissions — these can differ significantly when people submit multiple times

---

## 8. Color Theme

The app uses a **dark navy theme**:

```js
const COLORS = {
  surface: '#132F4C',       // Card/panel background
  surfaceLight: '#1A3A5C',  // Elevated surfaces, inputs
  text: {
    primary: '#E8EAED',     // Main text
    secondary: '#8B99A8',   // Secondary text
    light: '#5F6B7A',       // Muted text
  },
  border: '#1E3A5F',        // All borders
  accent: '#E94560',        // Primary action (red-pink)
  blue: '#3B82F6',          // Secondary action, links
  input: {
    bg: '#1A3A5C',
    border: '#2A5080',
    text: '#E8EAED',
  },
};
```

---

## 9. Build & Deploy Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Deploy to GitHub Pages (build + push)
npm run deploy

# Lint
npm run lint
```

---

## 9.5 Security Measures (v2.2 — Major Security Hardening)

### Authentication Security Layers (NEW)
The app implements a **multi-layer defense-in-depth** security architecture:

#### Layer 1: Firebase App Check (reCAPTCHA Enterprise)
- **Purpose**: Validates that requests come from a legitimate app instance (not bots/scripts)
- **Provider**: reCAPTCHA Enterprise (score-based, invisible to users — no CAPTCHA puzzles)
- **Configuration**: Set `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` in `.env`
- **Global Fallback**: If reCAPTCHA is unreachable (e.g., China where Google services are blocked), the app gracefully degrades to other security layers. A 3-second connectivity test determines availability.
- **File**: `src/firebase/security.js` — `initializeSecurityAppCheck()`
- **Setup Steps**:
  1. Enable reCAPTCHA Enterprise API in Google Cloud Console
  2. Create a score-based site key for the web domain
  3. Register the web app in Firebase Console > App Check
  4. Add the site key to `.env` as `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`

#### Layer 2: Client-Side Rate Limiting & Brute-Force Protection
- **Max Attempts**: 5 failed login attempts before temporary lockout
- **Lockout Duration**: 15 minutes (progressive — each subsequent lockout doubles: 15m → 30m → 60m → max 1 hour)
- **Minimum Interval**: 1 second between login attempts (prevents rapid-fire attacks)
- **Applies to**: Both email/password and Google Sign-In
- **Visual Feedback**: Lockout countdown timer shown on login screen with remaining attempts warning
- **File**: `src/firebase/security.js` — `checkLoginRateLimit()`, `recordLoginAttempt()`

#### Layer 3: Session Management with Automatic Timeout
- **Session Timeout**: 8 hours of inactivity → automatic logout
- **Warning**: Toast notification 15 minutes before timeout ("Session Expiring Soon")
- **Activity Detection**: Monitors mousedown, keydown, scroll, touchstart events
- **User Actions**: "Stay Logged In" (dismiss warning) or "Sign Out Now" buttons
- **File**: `src/firebase/security.js` — `startSessionMonitor()`

#### Layer 4: Security Audit Logging (Firestore)
- **Collection**: `securityAuditLog` in Firestore
- **Events Tracked**: 14 event types including login success/failure, lockouts, session timeouts, password changes, suspicious activity, Google login attempts, App Check fallbacks
- **Data Captured**: userId, email, userAgent, language, timezone, screen resolution, device fingerprint, App Check status
- **Admin Dashboard**: Settings page shows last 24h summary + expandable event log
- **File**: `src/firebase/security.js` — `logSecurityEvent()`, `SECURITY_EVENTS`

#### Layer 5: Password Policy Enforcement
- **Minimum Length**: 8 characters (signup enforced)
- **Strength Score**: 0-5 scale (must score ≥3 to register)
- **Requirements**: Mixed case, numbers, special characters (visual feedback during signup)
- **Common Password Detection**: Blocks "password", "123456", "qwerty", etc.
- **Visual Meter**: Real-time password strength bar with color coding (red → green)
- **File**: `src/firebase/security.js` — `evaluatePasswordStrength()`

#### Layer 6: Device Fingerprinting (Privacy-Respectful)
- **Method**: Lightweight hash of userAgent + language + screen resolution + timezone
- **NOT used**: Canvas fingerprinting, WebGL fingerprinting (privacy concerns)
- **Purpose**: Anomaly detection (logged in audit trail, not used for blocking)
- **File**: `src/firebase/security.js` — `getDeviceFingerprint()`

### Security UI Components (NEW)
| Component | Location | Purpose |
|-----------|----------|---------|
| Login lockout timer | `Login.jsx` | Countdown during account lockout |
| Password strength meter | `Login.jsx` (signup) | Real-time strength bar with color feedback |
| Password visibility toggle | `Login.jsx` | Eye/EyeOff button on password fields |
| Session timeout toast | `App.jsx` | Warning 15 min before auto-logout |
| Security Dashboard | `SettingsPage.jsx` | Admin-only security monitoring panel |

### Firestore & Storage Security Rules (NEW - v2.4)
Production-ready security rules are now included in the project root:
- **`firestore.rules`**: Auth-based rules for all Firestore collections
  - All read/write requires `request.auth != null`
  - Admin-only write for: `branchCodes`, `securityPolicies`, `importantLinks`, `securityAuditSchedules`, `settings`, `reports`, `securityNews`
  - Security audit logs are immutable (create only, no update/delete)
  - Users can only modify their own `userSecurity` documents
- **`storage.rules`**: Auth-based rules with file size limits
  - `document_library/`: 100 MB per file
  - `bulletin_attachments/`, `contracts/`, `uploads/`: 50 MB per file
- **`firebase.json`**: Points to the rules files for deployment
- **Deployment**: Run `firebase deploy --only firestore:rules,storage:rules` (requires Firebase CLI)
- **Note**: Current Firebase Console still shows `allow read, write: if true` — deploy these rules to enforce authentication

### Firestore Collections (NEW)
| Collection | Purpose |
|-----------|---------|
| `securityAuditLog` | Security event tracking (login, logout, lockout, etc.) |
| `userSecurity` | Per-user security metadata (last login, failed attempts, etc.) |

### Global User Accessibility
- **reCAPTCHA Enterprise**: Works in NA, Europe, most of Asia (invisible, no user friction)
- **China/Restricted Regions**: Automatic fallback — 3-second connectivity test, if blocked → skip App Check, rely on Layers 2-6
- **Detection Method**: Timezone + language heuristics (not IP-based), plus actual connectivity test
- **No User Friction**: reCAPTCHA Enterprise is score-based (invisible), no puzzles or checkboxes

### Firebase Identity Platform (Recommended Upgrade)
Upgrading to Firebase Authentication with Identity Platform enables:
- **Multi-Factor Authentication (MFA)** — SMS or TOTP second factor
- **Blocking Functions** — Custom logic to reject signups/logins based on conditions
- **User Activity Logging** — Server-side login audit trail
- **Enterprise SAML/OIDC** — SSO integration with corporate identity providers
- **How to Upgrade**: Firebase Console → Authentication → "Upgrade to Identity Platform" (non-breaking, preserves existing users)

### Pre-Existing Security Measures
- **XSS Protection**: All `dangerouslySetInnerHTML` usages wrapped with `DOMPurify.sanitize()` (PostDetail, PostEdit, PostWrite)
- **Firebase Config**: Uses environment variables (`import.meta.env.VITE_FIREBASE_*`), no hardcoded keys
- **Env Files**: `.env`, `.env.local`, `.env.*.local` in `.gitignore`
- **No eval()**: No `eval()` or `new Function()` usage
- **External Fetch**: Only Google Sheets CSV, Google News RSS, local TopoJSON — no untrusted origins
- **npm audit**: 2 low-severity issues (acceptable)

---

## 10. Changelog / Work History

### 2026-03-06 (Session 15 — Security Hardening)
- **SECURITY**: Implemented multi-layer defense-in-depth security architecture (6 layers)
- **NEW**: Firebase App Check integration with reCAPTCHA Enterprise (invisible, score-based, zero user friction)
- **NEW**: Global accessibility — automatic fallback for China/restricted regions where reCAPTCHA is blocked (3-second connectivity test → graceful degradation to other security layers)
- **NEW**: Client-side rate limiting — 5 failed attempts → progressive lockout (15m → 30m → 60m, max 1hr)
- **NEW**: Session management — 8-hour inactivity timeout with 15-minute warning toast ("Session Expiring Soon" with Stay/Sign Out buttons)
- **NEW**: Security audit logging — 14 event types tracked to `securityAuditLog` Firestore collection (login success/failure, lockouts, session timeouts, password changes, suspicious activity, device fingerprint)
- **NEW**: Password policy enforcement — strength meter (0-5 score, requires ≥3), blocks common passwords, visual feedback bar during signup
- **NEW**: Login UI enhancements — password visibility toggle (eye/eye-off), lockout countdown timer, remaining attempts warning, security badge in footer
- **NEW**: Admin Security Dashboard — in Settings page, shows App Check status, rate limiting config, session management status, password policy, global access info, 24h event summary, expandable audit log
- **NEW**: Per-user security metadata — `userSecurity` collection tracks last successful login, failed attempts, total logins per user
- **NEW**: Device fingerprinting (privacy-respectful) — lightweight hash of browser properties for anomaly detection
- **File**: `src/firebase/security.js` — comprehensive security module (20KB)
- **File**: `src/modules/settings/SecurityDashboard.jsx` — admin security monitoring UI
- **Modified**: `src/firebase/config.js` — exports `firebaseApp` for App Check init
- **Modified**: `src/firebase/auth.js` — integrated rate limiting, audit logging, security metadata in loginUser, logoutUser, registerUser, loginWithGoogle, resetPassword, changePassword
- **Modified**: `src/core/AuthContext.jsx` — App Check init on mount, session monitor lifecycle, security status context
- **Modified**: `src/components/Login.jsx` — lockout UI, password strength meter, visibility toggle, rate limit feedback
- **Modified**: `src/App.jsx` — session timeout toast (SessionWarningToast component)
- **Modified**: `src/App.css` — slideIn animation, light-inputs focus override for login form
- **Modified**: `src/modules/settings/SettingsPage.jsx` — integrated SecurityDashboard
- **Env**: New optional `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` (App Check activation)
- **Updated**: PROJECT_GUIDE.md to v2.2 with comprehensive security documentation (Section 9.5)
- **Build**: 0 errors, 2,547 modules
- **Deploy**: GitHub Pages + Vercel

### 2026-03-07 (Session 15 - Security Audit Schedule Integration)
- **Added**: Security Audit Schedule module (admin-only) integrated from standalone branch-security-audit app
- **Added**: `SecurityAuditSchedulePage.jsx` with table view, calendar view, CRUD operations, statistics dashboard
- **Added**: `AuditScheduleSettings.jsx` component integrated into existing Settings page
- **Added**: `auditSchedule.js` Firestore helper with full CRUD + settings management
- **Added**: "Audit Schedule" sidebar menu item (admin-only, CalendarDays icon)
- **Added**: `/security-audit` route in App.jsx
- **Added**: New Firestore collections: `securityAuditSchedules`, `settings/auditScheduleSettings`
- **Fixed**: PostDetail.jsx JSX syntax error (extra `}` on line 514)
- **Updated**: PROJECT_GUIDE.md to v2.3
- Build: 0 errors, 2550 modules

### 2026-03-08 (Session 17 - Authentication Bug Fixes & Security Hardening v2.3)

#### Bug Fixes (Critical - Authentication Failures)
- **FIXED**: Email login failure — `updateLoginSecurityMeta(email, false, email)` was passing the user's email address as a Firestore document ID to `userSecurity/{uid}`. Since the user was NOT authenticated (login failed), Firestore security rules correctly rejected the write (`isOwner(userId)` check failed). This caused a silent Firestore permission error that could cascade and block the login flow.
  - **Root Cause**: On failed email login, the code called `updateLoginSecurityMeta(email, ...)` with `email` as the first argument (uid). The Firestore rule `isOwner(userId)` checks `request.auth.uid == userId`, which fails because (a) the user isn't authenticated after a failed login, and (b) even if they were, an email address is not a valid Firebase UID.
  - **Fix**: Removed the `updateLoginSecurityMeta()` call from the failed login path entirely. Failed login tracking is now handled purely by client-side rate limiting (which doesn't need Firestore writes).
  
- **FIXED**: Google login failure — improved error handling with more specific error codes:
  - Added `auth/internal-error` and `auth/network-request-failed` handlers with user-friendly messages
  - Enhanced error messages now include `currentOrigin` for easier domain configuration debugging
  - Added redirect URI guidance (`/__/auth/handler`) to the `auth/unauthorized-domain` error message
  - Enhanced console logging with both `popupError.code` and `popupError.message` for better debugging
  
- **FIXED**: Account creation failure — registration was being blocked by security audit logging trying to write to Firestore collections that the newly-created user didn't have permission to access yet.

#### Security Module v2.3 (`security.js`)
- **NEW**: Pre-auth event queue system — security events that occur before the user authenticates (failed login attempts, rate limit lockouts, App Check fallback) are queued in memory and automatically flushed to Firestore after successful authentication via `onAuthStateChanged` listener.
  - Queue auto-clears after 5 minutes if no successful auth occurs (prevents memory leak)
  - Queued events include all original metadata (timestamps, device fingerprint, etc.)
- **FIXED**: `updateLoginSecurityMeta()` now validates inputs:
  - Skips Firestore write if `auth.currentUser` is null (prevents permission errors)
  - Rejects uid values that contain `@` (prevents email-as-uid bug)
  - Only updates failed attempt counters when `currentUser.uid === uid` (owner-only write)
- **IMPROVED**: `logSecurityEvent()` now checks `auth.currentUser` before attempting Firestore write; queues event if user is not authenticated
- **IMPORT**: Added `onAuthStateChanged` import from `firebase/auth` for auth flush listener

#### Firestore Rules Update (`firestore.rules`)
- **ADDED**: 6 missing collection rules:
  - `systemConfig/{docId}` — used by SecurityPolicyPage (`systemConfig/securityPolicy`), admin-only write
  - `exchangeRates/{docId}` — monthly rate tables, admin-only write
  - `contracts/{docId}` + `contracts/{docId}/chunks/{chunkId}` — contract files with chunk sub-collection
  - `attachments/{docId}` + `attachments/{docId}/chunks/{chunkId}` — monthly attachment files with chunk sub-collection
- **FIXED**: `securityPolicies` rule retained for backward compatibility; actual collection is `systemConfig`
- **IMPROVED**: Comprehensive comments documenting each collection's purpose and access patterns

#### Build Optimization (`vite.config.js`)
- **ADDED**: `build.rollupOptions.output.manualChunks` for code splitting:
  - `vendor-firebase`: Firebase SDK (393KB → separate chunk, cached independently)
  - `vendor-react`: React + React DOM + React Router (48KB chunk)
  - `vendor-ui`: lucide-react icons (21KB chunk)
- **ADDED**: `build.minify: 'esbuild'` for faster, lower-memory minification
- **RESULT**: Build succeeds within 1GB RAM environment (was OOM-killed with single chunk)

#### Failure Record & Root Cause Analysis
| Issue | Error Code | Root Cause | Fix |
|-------|-----------|------------|-----|
| Email login fails | Firestore `PERMISSION_DENIED` (silent) | `updateLoginSecurityMeta(email, false, email)` — passed email as Firestore doc ID; user not authenticated | Removed failed-login Firestore write; client-side rate limiting only |
| Google login fails | `auth/unauthorized-domain` | Deployment domain not in Firebase Auth authorized domains AND not in Google Cloud OAuth origins/redirects | Enhanced error message with both origin + redirect URI instructions |
| Account creation fails | Firestore `PERMISSION_DENIED` (silent) | `logSecurityEvent()` tried to write to `securityAuditLog` before new user profile was fully set up | Added pre-auth event queue; events flush after auth state confirms |
| Security logging fails | Firestore `PERMISSION_DENIED` | Pre-login events (lockout, failed attempt) tried Firestore write without `auth.currentUser` | `logSecurityEvent()` now queues pre-auth events in memory |
| Missing collection rules | Firestore `PERMISSION_DENIED` | `systemConfig`, `exchangeRates`, `contracts`, `attachments` had no rules (catch-all `deny all`) | Added explicit rules for all 6 missing collections + sub-collections |
| Build OOM killed | Process `Killed` signal | Single 1.4MB JS chunk exceeded 1GB sandbox RAM during minification | Added manual chunks splitting + esbuild minifier |

#### App Check — AI Logic Question
- **Answer**: App Check for AI Logic (Vertex AI / Gemini) is **NOT needed** for this project because:
  1. The Gemini AI API calls use the `@google/genai` client SDK with a `VITE_GEMINI_API_KEY`, not Firebase AI/Vertex integration
  2. App Check protects Firebase-integrated services (Firestore, Auth, Storage, Cloud Functions); the Gemini API is a separate Google Cloud product
  3. If the project migrates to Firebase AI (`firebase/vertexai`), then AI Logic enforcement should be enabled
  4. Current Gemini usage (translation) has low abuse risk — API key quota limits provide sufficient protection

#### Files Modified
- `src/firebase/security.js` — v2.3: pre-auth event queue, safe `updateLoginSecurityMeta`, `onAuthStateChanged` import
- `src/firebase/auth.js` — removed broken `updateLoginSecurityMeta(email, false, email)` call; enhanced Google login error messages
- `firestore.rules` — added 6 missing collections + sub-collections
- `vite.config.js` — added manual chunks + esbuild minifier
- `PROJECT_GUIDE.md` — v2.5: comprehensive technical specs, failure records, updated Firestore collections table
- Build: **0 errors**, 2550 modules, ~14s
- Console: **0 errors** (only expected App Check fallback warning in sandbox)

### 2026-03-08 (Session 16 - Security Rules, App Check & Audit Schedule Enhancement)
- **Added**: Firebase security rules files (`firestore.rules`, `storage.rules`, `firebase.json`)
  - Replaced open `allow read, write: if true` with proper auth-based rules
  - All collections require `request.auth != null` for read/write
  - Admin-only write for settings, audit schedules, policies, links
  - Immutable security audit logs (no update/delete)
  - Storage rules with file size limits (100MB documents, 50MB attachments)
- **Verified**: App Check initialization with sitekey `6LeJXIMsAAAAADFkE1nIoxWx0Pp7TYeRjodH2osb`
  - `.env` already has `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` configured
  - `security.js` properly initializes `ReCaptchaEnterpriseProvider` with fallback for restricted regions
  - `AuthContext.jsx` calls `initializeSecurityAppCheck(firebaseApp)` on mount
  - Console confirms correct behavior: Active in supported regions, graceful fallback otherwise
- **Enhanced**: SecurityAuditSchedulePage with comprehensive improvements
  - NEW: Annual Schedule Table (12-month Gantt-style view grouped by branch)
  - NEW: Inspector View (cards grouped by auditor with schedule lists & stats)
  - NEW: Light background theme with dark text for improved readability
  - NEW: 4 view modes: Annual, Table, Calendar, Inspector
  - IMPROVED: Status badges with color-coded backgrounds and borders
  - IMPROVED: Statistics dashboard with light colored cards
  - IMPROVED: All modals updated to light theme with backdrop blur
- **Added**: Upcoming Security Inspection card on HomePage dashboard (admin-only)
  - Shows this month's and next month's audit schedules
  - Two-column layout with branch names, dates, inspectors, status
  - Overdue indicator with red highlight
  - "View All" button navigating to `/security-audit`
- **Added**: `getUpcomingAudits()` helper in `auditSchedule.js` for HomePage
- **Updated**: PROJECT_GUIDE.md to v2.4
- Build: 0 errors, 2550 modules

### 2026-03-04 (Session 13)
- **Fixed**: World map horizontal banding artifacts — removed latitude grid lines that created prominent horizontal stripes across the map. Removed the CSS linear-gradient background that caused additional banding. Replaced with clean solid ocean color (#0b1929) + subtle radial glow
- **Improved**: Country fill contrast — changed from `fill="#172e4a" opacity="0.85"` to `fill="#1a3a5c"` (full opacity) with better border strokes (`#254d73`, 0.5px, round joins) for clearer land mass definition
- **Improved**: Kept only subtle vertical longitude lines (no horizontal latitude lines) — eliminates visual banding while maintaining geographic reference
- **Fixed**: Marker zoom scaling — station markers now rendered outside the SVG zoom transform group with individual `translate()` positioning; markers maintain constant pixel size at any zoom level
- **Fixed**: Double-click & scroll-wheel zoom centering — corrected map↔screen coordinate math so zoom centers on the mouse cursor position
- **Improved**: Initial map view panned vertically so ICN (lat 37.46°N) appears near vertical center instead of equator-centered default
- **Updated**: PowerPoint guide documents regenerated with latest features
- **Updated**: PROJECT_GUIDE.md to v2.1
- **Backup**: Project archive saved to AI Drive
- **Build**: 0 errors, 2,543 modules
- **Deploy**: GitHub Pages, PR #66 (map zoom fixes) + PR #67 (map cleanup) merged

### 2026-03-04 (Session 12)
- **Fixed**: Removed 'TA' prefix from Security Directive board — HQ admin posts no longer show site code prefix in Directive board (only Communication board shows prefixes)
- **Implemented**: Real drag-and-drop file upload in PostWrite — added dragenter/dragleave/dragover/drop event handlers with visual feedback (border color + icon change on hover)
- **Fixed**: Sidebar sub-menu collapse bug — clicking the collapse toggle on "Security Bulletins" parent now works even when a child route is active. Added `userToggledGroups` state to track explicit user toggles vs auto-expand behavior
- **Fixed**: Site code prefix display — changed from variable-width (2-4 chars) to fixed-width (3 chars max), centered alignment (`display: inline-block; width: 2.2em; text-align: center`) for consistent badge appearance
- **Upgraded**: AI translation model from `gemini-2.5-flash-lite` → `gemini-2.5-flash` across all 3 files (PostWrite, PostDetail, PostEdit) for better translation consistency and quality
- **Added**: Emoji picker in comments — Smile icon button next to comment input opens a 30-emoji grid popup (10x3) with commonly used emojis (thumbs up/down, check, warning, airplane, lock, etc.)
- **Improved**: Board-aware labels — Communication board now shows contextual labels ('Title' instead of 'Directive Title', 'New Post', 'Edit Post', 'Publish Post')
- **Generated**: 4 editable PowerPoint presentations:
  - `AirZeta_Admin_Guide_KR.pptx` — Korean, detailed admin manual (62KB, 20+ slides)
  - `AirZeta_Branch_User_Guide_EN.pptx` — English, step-by-step branch user guide (39KB, 9 slides)
  - `AirZeta_IT_Planner_Guide_KR.pptx` — Korean, technical architecture/AI/security (52KB, 14 slides)
  - `AirZeta_Executive_Finance_Guide_KR_EN.pptx` — Korean+English, cost analysis with charts (56KB, 12 slides)
- **Updated**: PROJECT_GUIDE.md to v2.0
- **Build**: 0 errors, 2,543 modules
- **Deploy**: GitHub Pages (Published), PR #64 merged

### 2026-03-04 (Session 11)
- **Added**: YNT (Yantai, China) airport to AIRPORT_COORDS (lat: 37.66, lng: 120.98) and MINI_AIRPORT_COORDS
- **Fixed**: Security Fee AdminDashboard KRW total calculation — changed from branch-level total conversion (`totalEstimated * rate`) to **per-item conversion** (`sum of each item.estimatedCost * item-specific rate`). The per-item approach ensures each item is converted using its own currency's exchange rate, then summed.
- **Fixed**: Exchange rate Excel parsing precision — `read-excel-file` reads the raw IEEE 754 double from Excel cells, which may contain hidden extra decimal places beyond what Excel displays (e.g., cell shows `1,450.30` but raw value is `1450.3042...`). Added `Math.round(rawRate * 100) / 100` to round rates to 2 decimal places at upload time, matching the user-visible Excel values. This resolves the ~4,500 KRW discrepancy between manual calculation and app display on ~971M KRW totals.
- **Architecture note**: Excel column mapping: A=비율(원시)/sourceRatio, B=원시통화, C=비율(대상)/targetRatio(unused, always 1 for KRW), D=대상통화, E=직접호가/directQuote, F=간접호가(unused). The `monthlyKRWTotals` in AdminDashboard iterates `cost.items[]` array for per-item currency conversion, falls back to branch-level for legacy data.
- **Important**: After deploying this fix, the exchange rate file must be **re-uploaded** for affected months to apply the rounding correction to stored rates in Firestore.
- **Updated**: PROJECT_GUIDE.md to v1.9
- **Build**: 0 errors, 2,543 modules

### 2026-03-03 (Session 10)
- **Added**: ANC (Anchorage) airport to AIRPORT_COORDS and MINI_AIRPORT_COORDS (lat: 61.17, lng: -150.00)
- **Security Fix**: Added DOMPurify sanitization to ALL 6 `dangerouslySetInnerHTML` usages in bulletin module (PostDetail, PostEdit, PostWrite). Previously unsanitized HTML from Firestore was rendered directly, creating XSS risk.
- **Security Audit**: Verified Firebase config uses env vars, no hardcoded secrets, no eval(), .env in .gitignore, npm audit shows only 2 low-severity issues
- **Updated**: PROJECT_GUIDE.md to v1.8, CLAUDE.md v2.0, GEMINI.md v2.0, AI_HANDOFF_PROMPT.md v2.0 — all onboarding guides rewritten to reflect current multi-module architecture (previous versions described the legacy single-page fee-only app)
- **Documentation**: All AI guides now include complete module list, file structure, Firestore collections, AIRPORT_COORDS rules, DOMPurify requirements, and backup/restore instructions
- **Build**: 0 errors, 2,543 modules (DOMPurify +1)
- **Deployed**: GitHub Pages + Vercel (auto-deploy from main)

### 2026-03-03 (Session 9)
- **Changed**: Security Level page — global world map view now accessible to ALL users (was admin-only). Branch users see the map read-only with no edit controls; a separate "Edit My Station" button lets them edit their own station. Admin users retain full click-to-edit functionality on markers and cards.
- **Improved**: Mini-map Station Statistics overlay — changed from vertical box (bottom-right) to **horizontal bottom bar** spanning the full width. This covers less map area while improving readability. Uses flex row layout with colored dots, tier counts, labels, and total stations separated by a vertical divider.
- **Verified**: Pledge Submissions count is **89** (correct). Google Sheet has 90 data rows; 1 test entry ("작동 테스트") is excluded. Previous claim of "90" was inaccurate.
- **Updated**: PROJECT_GUIDE.md to v1.7 with Security Level access control documentation (Section 6.1), mini-map legend layout notes, and pledge count clarification.
- **Build**: 0 errors, 2,542 modules

### 2026-03-02 (Session 8)
- **Improved**: Security Level mini-map on Home Dashboard — replaced hand-drawn SVG continent shapes with **real TopoJSON country outlines** loaded at runtime via `topojson-client`, producing an accurate detailed world map at card size
- **Removed**: IATA code labels from mini-map station markers for security (prevents identifying registered stations)
- **Improved**: Statistics legend overlay (bottom-right) enlarged to vertical layout with "Station Statistics" title, larger color dots (7px), per-tier labels (Safe/Caution/Alert), and total station count with blue accent
- **Fixed**: Security Pledge donut chart count — changed from 86 (unique signers after deduplication) to correct total of 90 (all valid non-test submissions). Chart now shows total **submissions** not unique persons
- **Fixed**: Google Sheets CSV empty-row filtering — added `!isNaN(new Date(timestamp))` validation to prevent counting hundreds of trailing empty rows that Google Sheets exports
- **Added**: `miniGeoPath()` utility function to convert GeoJSON geometry to SVG path strings for the mini-map
- **Added**: `topojson-client` import to HomePage.jsx (already in project dependencies)
- **Updated**: Donut chart label from "SIGNATORIES" to "SUBMISSIONS"
- **Updated**: PROJECT_GUIDE.md to v1.6 with mini-map architecture notes, CSV empty-row lesson learned
- **Build**: 0 errors, 2,542 modules

### 2026-03-02 (Session 7)
- **Fixed (CORRECT)**: DocumentEdit drag-and-drop upload — REMOVED form-level drag event handlers (`onDragOver`, `onDragEnter`, `onDrop`) that were consuming drop events before the inner drop zone could process them. This was the actual root cause (Session 6 fix was incorrect — it ADDED form handlers that caused the same problem)
- **Enhanced**: Security Pledge Card with Google Sheets integration:
  - Fetches signatory data from published Google Sheet (ID: `1rAN--sDV6dj9N5fgB71y7NoUyjgfkOHnmyAoBRiuHIw`) via CSV endpoint
  - Donut chart SVG showing total unique signatories (deduped, test entries excluded)
  - Lists up to 8 recent signers (last 30 days) with privacy-masked names
  - Name masking: Korean "홍*동", English "Tae*** h**" (~1/3 asterisked)
  - Admin-only "View Responses" button linking to the editable Google Sheet
  - Custom CSV parser handles quoted fields with commas
- **Updated**: lucide-react imports to include Users, CheckCircle2
- **Updated**: PROJECT_GUIDE.md to v1.5 with corrected drag-drop analysis and Google Sheets integration docs
- **Updated**: User manual v2.3 with enhanced pledge card documentation
- **Build**: 0 errors, 2,542 modules

### 2026-03-02 (Session 6)
- **Improved**: Security Level mini map on Home Dashboard — SVG path continent outlines, connection lines between nearby stations, animated pulse rings for alert stations, glow filters per risk tier, IATA labels, "Global Status" overlay
- **Improved**: Security Fee mini chart on Home Dashboard — gradient area fills, enhanced endpoint dots, TrendingUp icons in stat boxes, centered legend
- **Improved**: Security Pledge Agreement card — decorative backgrounds, QR hover animation, status badges, "New Tab" link
- **Note**: Session 6 drag-and-drop fix was INCORRECT (added form-level handlers that caused the problem). Corrected in Session 7.
- **Updated**: User manual to v2.2 with enhanced Dashboard card descriptions
- **Updated**: PROJECT_GUIDE.md to v1.4
- **Build**: 0 errors, 2,542 modules

### 2026-03-02 (Session 5)
- **Added**: Airport code (IATA) input field in Security Level form with autocomplete dropdown from AIRPORT_COORDS
- **Added**: 30 new airports to AIRPORT_COORDS (STN, LGW, LTN, VIE, BRU, CPH, OSL, HEL, WAW, PRG, BUD, LIS, ATH, MXP, DUS, HAM, SEA, DFW, IAD, MIA, YVR, AKL, PNH, RGN, KTM, CJU, PUS, TAE, OKA) — total now ~85
- **Fixed**: Document Library drag-and-drop download — changed `<button>` to `<a>` with `draggable`, `href/download`, and `DownloadURL` dataTransfer
- **Improved**: Document detail restricted files now show file names with sizes (grayed out + lock icon) even when download is not permitted
- **Confirmed**: Document Library file list is visible to ALL users/branches; download permission only controls file download ability
- **Confirmed**: `airportCode` field already saves/loads to Firestore securityLevels; admin map view uses it for marker placement
- **Updated**: PROJECT_GUIDE.md to v1.3 with lessons learned (drag-and-drop download, branch vs airport code, build performance)
- **Updated**: User manual v2.1 already includes Document Library and airport code sections

### 2026-03-02 (Session 4)
- **Fixed**: HR rendering completely - registered custom `DividerBlot` (BlockEmbed) so `<hr>` persists in Quill Delta after save
- **Fixed**: HR now uses Quill API `insertEmbed('divider', true)` instead of broken `setContent(prev + '<hr>')`
- **Improved**: Table border visibility in editor - changed color from `#2A5080` to `#4A7AB5` for better contrast
- **Added**: `'divider'` format registered in quillFormats for both PostWrite and PostEdit
- **Created**: Document Library module (`/document-library`) with:
  - Dashboard with search, category filter, sorted list (pinned first)
  - Upload page: IATA code selector, category, title, description, permission, pin, file upload (100MB)
  - Detail page: file download with tracking, admin-only download log view
  - Edit page: modify all document metadata and attachments
  - Permission system: Admin Only / All Branches + auto-grant to uploader's branch
  - Download tracking: records userId, email, branch, fileName, timestamp per download
  - Admin-only pin-to-top feature
- **Added**: Navigation item "Document Library" with FolderOpen icon in PortalLayout
- **Added**: Route `/document-library/*` in App.jsx
- **Added**: Firestore collection `documentLibrary` for document storage
- **Updated**: PROJECT_GUIDE.md to v1.2

### 2026-03-02 (Session 3 - Part 2)
- **Fixed**: Table rendering completely - switched to Quill 2 native table module with `insertTable(rows, cols)` API
- **Added**: Quill 2 table formats registered: `table`, `table-row`, `table-body`, `table-container`
- **Added**: CSS for `td[data-row]` to support Quill 2 native table styling
- **Updated**: PROJECT_GUIDE.md to v1.1 with corrected table implementation documentation

### 2026-03-02 (Session 3 - Part 1)
- **Fixed**: Quill `Cannot register "bullet"` error - removed `'bullet'` from quillFormats
- **Fixed**: Table insertion - initially tried direct content state injection (still broken, see Part 2)
- **Fixed**: Security Level history - entries now only created on Save, not on level click
- **Restored**: Horizontal Rule (HR) button in editor
- **Created**: This PROJECT_GUIDE.md

### 2026-03-02 (Session 2)
- **Added**: Underline restored to editor toolbar
- **Added**: Table insert dialog (rows/cols configurable)
- **Added**: View count on bulletin posts
- **Added**: KOR/ENG/local translate buttons on comments
- **Added**: Enter key creates line breaks
- **Fixed**: Security Level history date uses "Effective Since"
- **Docs**: Portal Usage Manual v2.0 (Admin + User)

### 2026-02-27 (Session 1)
- **Added**: Realistic world map with TopoJSON (Natural Earth 110m)
- **Added**: Admin station editing via world map click
- **Added**: Level change history with delete
- **Added**: Optional color support for security levels
- **Improved**: Links page UX (grouped, clickable cards)
- **Fixed**: QR code functionality (replaced old library with qrcode.react)
- **Added**: Markdown editor support (toggle between rich text and MD)
- **Added**: AI translation for bulletin posts
- Various bug fixes and UI improvements

### Earlier History
- Initial project setup with Firebase, React Router, dark theme
- Security fee management module
- Bulletin board with acknowledgement tracking
- Security policy viewer
- User management and role-based access

---

## 11. Important Data & Variables

### AIRPORT_COORDS
The `SecurityLevelPage.jsx` contains an `AIRPORT_COORDS` object mapping IATA 3-letter codes to `{lat, lng, city}` for ~85 airports worldwide. New stations can be added by including their IATA code in this dictionary. The `airportCode` field in `securityLevels` Firestore documents takes priority over auto-extracted codes from branch names.

### LANGUAGE_OPTIONS
Used across bulletin modules for AI translation:
- Korean (ko), English (en), Japanese (ja), Chinese (zh), German (de), French (fr), Spanish (es), Arabic (ar), Thai (th), Vietnamese (vi)

### Risk Color Mapping
| Color | Hex | Meaning |
|-------|-----|---------|
| Green | #22c55e | Safe / Normal |
| Orange | #f97316 | Caution / Elevated |
| Red | #ef4444 | Alert / High |

### COLOR_KEYWORDS (Security Level)
Level names containing these keywords auto-detect their color:
- green, blue, yellow, orange, red, white, gray/grey
- Korean equivalents: 초록, 파랑, 노랑, 주황, 빨강, 평시, 관심, 주의, 경계, 심각

---

## 12. Troubleshooting

| Problem | Solution |
|---------|----------|
| White/blank screen after deploy | Check that HashRouter is used (not BrowserRouter). Check base path in vite.config.js |
| Firebase permission denied | Check Firestore rules. Ensure user is authenticated. |
| Gemini translation fails | Verify VITE_GEMINI_API_KEY in .env. Check API key permissions at aistudio.google.com |
| Quill editor format errors | Only use format names that react-quill-new recognizes. `'list'` covers both ordered and bullet lists. Do NOT add `'bullet'` separately. |
| Table not rendering in editor | Use Quill 2 native table module: add `table: true` to modules and register all table format names. Use `insertTable()` API, NOT HTML injection. |
| TopoJSON map not loading | Ensure `countries-110m.json` exists in `/public/` directory |
| Deploy fails with Vercel token error | Use `npm run deploy` (gh-pages) instead. Vercel auto-deploys from main. |
| View count not incrementing | The `viewCount` field may not exist on old posts. The `increment(1)` call handles this gracefully. |
| HR disappears after save | Must register a custom DividerBlot (`blots/block/embed`, tagName='hr', blotName='divider'). Use `insertEmbed()` API, NOT content state injection. |
| Document Library access denied | Check Firestore rules for `documentLibrary` collection. Ensure `storage.rules` allows `document_library/` path. |
| DocumentEdit drag-drop upload not working | Ensure the `<form>` element does NOT have `onDrop`/`onDragOver`/`onDragEnter` handlers — they consume drag events before the inner drop zone. Only the drop zone div should have drag handlers. |
| Pledge signer data not loading | The Google Sheet must be shared as "Anyone with the link can view". Check browser console for CORS or network errors. |
| App Check not activating | Ensure `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is set in `.env`. Check reCAPTCHA Enterprise API is enabled in Google Cloud Console. Verify the site key is registered in Firebase Console > App Check. |
| App Check failing in China | Expected behavior. The app auto-detects reCAPTCHA unavailability and falls back to other security layers. No action needed. |
| Login lockout won't clear | Client-side lockout resets on page refresh. Server-side Firebase `auth/too-many-requests` requires waiting (usually 15-60 min). |
| Security audit logs not appearing | Check Firestore rules allow write to `securityAuditLog` collection. The logging is fire-and-forget (silently fails if blocked). |
| Session timeout too aggressive | Adjust `SESSION_TIMEOUT_MS` in `src/firebase/security.js` (default 8 hours = 28800000 ms). |
| Audit Schedule not visible in sidebar | Only visible to `hq_admin` role users. Branch users will not see the menu item. |
| Audit Schedule settings not saving | Check Firestore rules allow write to `settings` collection for authenticated admins. |
| Audit schedules not loading | Ensure Firestore rules allow read on `securityAuditSchedules` collection for authenticated users. |
| Google login `auth/unauthorized-domain` | Add your deployment domain to: (1) Firebase Console > Auth > Settings > Authorized domains, AND (2) Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID > Authorized JavaScript origins + redirect URIs. Wait 5-10 min after saving. |
| Email login silent failure | Check browser console for Firestore `PERMISSION_DENIED`. Ensure `securityAuditLog` rules allow `create: if isSignedIn()`. If the error occurs pre-auth, it's expected and handled by the event queue. |
| Account creation fails silently | The `registerUser()` flow creates Firebase Auth user, then writes to Firestore `users` collection. If Firestore rules block the write, the user exists in Auth but has no profile. Check `users/{userId}` create rule requires `isOwner(userId)`. |
| Exchange rates not saving | Ensure `exchangeRates` collection has Firestore rules. Previously this collection was missing from rules (fixed in v2.5). |
| Contract files not loading | Ensure `contracts` and `contracts/{id}/chunks` collections have Firestore rules. Previously missing (fixed in v2.5). |
| Build OOM killed in sandbox | Use `NODE_OPTIONS='--max-old-space-size=768'` for 1GB RAM environments. The `vite.config.js` manual chunks help reduce peak memory. |
| Security events lost on failed login | Expected behavior in v2.3. Pre-auth events are queued in memory and flushed after successful login. If the user never logs in, events are discarded after 5 minutes. |
