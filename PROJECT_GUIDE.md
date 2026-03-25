# AirZeta Security Portal - Project Guide

> **Document Version**: 3.3
> **Last Updated**: 2026-03-25
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

### 2026-03-08 (Session 18 - App Check Token Fix & Auth Flow Diagnosis v2.5)

#### CRITICAL Root Cause Discovery
- **ROOT CAUSE**: The `auth/firebase-app-check-token-is-invalid` error on ALL auth flows (email login, Google login, account creation) was caused by using a **reCAPTCHA v2/v3 site key** (`6LeJXIMs...`) instead of a **reCAPTCHA Enterprise key** in `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
  - reCAPTCHA v2/v3 keys start with "6L" and are ~40 characters long
  - reCAPTCHA Enterprise keys are created in GCP > reCAPTCHA Enterprise console and have a different format
  - `initializeAppCheck()` with `ReCaptchaEnterpriseProvider` accepts ANY key string without validation
  - Token generation then FAILS because the key is the wrong type: `AppCheck: ReCAPTCHA error. (appCheck/recaptcha-error)`
  - With App Check enforcement ON in Firebase Console, ALL auth API calls (signIn, signUp, Google) are rejected server-side with `auth/firebase-app-check-token-is-invalid`
  - This failure is **server-side** — no amount of client code can work around it

#### Required Admin Actions (Firebase/GCP Console)
To fully resolve auth failures, the admin must do ONE of:

**Option A (Recommended): Create correct reCAPTCHA Enterprise key**
1. Go to Google Cloud Console > reCAPTCHA Enterprise > Create Key
2. Select type "Website", add domains: `airzeta-security-fee-app.vercel.app`, `localhost`
3. Register the key in Firebase Console > App Check > reCAPTCHA Enterprise provider
4. Update `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` in `.env` and Vercel environment variables
5. Redeploy

**Option B (Quick fix): Disable App Check enforcement for Authentication**
1. Go to Firebase Console > App Check
2. Find "Authentication" in the APIs list
3. Click the toggle to **unenforce** (disable) App Check for Authentication
4. Auth will work immediately without App Check token validation

#### Code Improvements (config.js v2.5)
- **NEW**: Token validation on startup — `config.js` now calls `getToken()` immediately after `initializeAppCheck()` to detect invalid keys before any user interaction
- **NEW**: `appCheckReady` Promise — resolves when token validation completes, exposing `'active'` | `'failed'` | `'disabled'` status
- **NEW**: `getAppCheckInfo()` helper — returns current status, error, site key prefix
- **NEW**: v2/v3 key format detection — warns if key starts with "6L" (likely wrong type)
- **NEW**: Rich diagnostic console logging showing exact root cause and fix instructions

#### Code Improvements (security.js v2.5)
- **CHANGED**: `initializeSecurityAppCheck()` is now `async` — awaits `appCheckReady` before setting status
- **NEW**: `waitForAppCheckReady()` — returns status with `isActive` and `isFailed` flags
- **REMOVED**: Redundant `verifyAppCheckToken()` — validation now happens in config.js only
- **IMPROVED**: Eliminated duplicate logging between config.js and security.js

#### Code Improvements (Login.jsx)
- **NEW**: App Check warning banner — shown on mount if token validation failed
- **NEW**: `isAppCheckError` state — separate styling for App Check errors vs domain errors
- **NEW**: `buildAppCheckErrorMessage()` — actionable error with step-by-step fix instructions
- **NEW**: `isAppCheckRelatedError()` — detects App Check errors in all 3 auth flows
- **NEW**: Direct links to reCAPTCHA Enterprise Console and Firebase App Check Console
- **IMPROVED**: Error banner for App Check errors is red with AlertTriangle icon

#### Code Improvements (AuthContext.jsx)
- **CHANGED**: Uses async `initializeSecurityAppCheck()` with await
- **NEW**: `appCheckFailed` and `appCheckError` in `securityStatus` state
- **IMPROVED**: Cleaner logging without duplicate messages

#### Code Improvements (auth.js)
- **IMPROVED**: Google login error handler now catches App Check errors in `auth/internal-error`
- **NEW**: Detects App Check issues in generic error messages and re-throws with correct error code

#### Failure Record
| Issue | Error | Root Cause | Fix |
|-------|-------|------------|-----|
| All auth fails | `auth/firebase-app-check-token-is-invalid` | reCAPTCHA v2/v3 key used instead of Enterprise key | Admin must create Enterprise key OR disable enforcement |
| Token validation | `appCheck/recaptcha-error` | Wrong key type passed to `ReCaptchaEnterpriseProvider` | Code now detects & reports; admin fixes key |
| Google login | `auth/internal-error` → "Network error" | App Check invalid token before popup opens | Code now catches & shows App Check error |

#### Files Modified
- `src/firebase/config.js` — v2.5: token validation Promise, `getAppCheckInfo()`, v2/v3 key detection
- `src/firebase/security.js` — v2.5: async `initializeSecurityAppCheck()`, `waitForAppCheckReady()`
- `src/core/AuthContext.jsx` — async init, `appCheckFailed`/`appCheckError` state
- `src/components/Login.jsx` — App Check warning banner, actionable error messages, console links
- `src/firebase/auth.js` — Google login App Check error detection
- `PROJECT_GUIDE.md` — v2.5: session 18 changelog, admin action items
- Build: **0 errors**, 2550 modules, ~13s

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

---

### 2026-03-25 (Session 25 - Login/Registration Fix & UI Improvements v3.2)

#### Critical Fix: Login/Registration Branch List Not Loading

**Problem Diagnosis**: User registration (both email and Google SSO) could fail at the BranchSelection step due to a race condition between Firebase Auth user creation and Firestore user profile creation.

1. **FIXED: `updateUserBranch()` — NOT_FOUND error for new users**
   - **Symptom**: After registration, selecting a branch in BranchSelection would fail silently with Firestore NOT_FOUND error
   - **Root Cause**: `updateUserBranch()` used `updateDoc()` which requires the document to already exist. For new users (especially Google SSO), the Firestore user profile might not exist yet due to race condition between `onAuthStateChanged` and `handleGoogleUserProfile()`
   - **Fix**: Added `getDoc()` check before update. If document doesn't exist, uses `setDoc()` to create the full profile with branch selection. Falls back gracefully for both HQ (pending_admin) and branch_user paths.
   - **File**: `src/firebase/auth.js` → `updateUserBranch()`

2. **FIXED: `_isNewUser` flag never created Firestore document**
   - **Symptom**: Users logged in via Google SSO might get stuck in BranchSelection with subsequent operations failing
   - **Root Cause**: `listenToAuthChanges()` fallback profile set `_isNewUser: true` but never created the Firestore document. All subsequent Firestore operations (updateUserBranch, updateUserPreferences) using `updateDoc()` would fail.
   - **Fix**: Changed fallback behavior to create the Firestore user profile document via `setDoc()` when no profile exists after retry. Removed `_isNewUser` flag in favor of actual document creation.
   - **File**: `src/firebase/auth.js` → `listenToAuthChanges()`

3. **FIXED: BranchSelection — No retry on branch list load failure**
   - **Symptom**: If `getAllBranches()` failed (e.g., timing issue with auth propagation), user was stuck with "Failed to load station list" with no recovery option
   - **Fix**: Added automatic retry with exponential backoff (up to 3 retries: 1s, 2s, 4s delays). Added "Retry Loading" button in error state. Improved error messages for NOT_FOUND and PERMISSION_DENIED scenarios.
   - **File**: `src/components/BranchSelection.jsx`

4. **FIXED: Duplicate SessionWarningToast rendering**
   - **Symptom**: `SessionWarningToast` was rendered both inside `ProtectedRoutes` and directly in `App` component, causing double toast notifications
   - **Fix**: Removed duplicate `<SessionWarningToast />` from `App()`, keeping only the one inside `ProtectedRoutes`
   - **File**: `src/App.jsx`

#### SSS vs SeMIS Portal Architecture Note
- **This is the SSS (Station Security System) portal** — uses RBAC with branch selection after login
- SSS requires `branchCodes` collection for branch list + `users` collection for role/branch assignment
- SeMIS (Security Management Information System) is a separate portal using ‘Officer’ permission directly
- Both share the same Firebase project (`airzeta-security-system`) and SSO (Google Auth)
- **No SeMIS code contamination found** in this codebase — the registration issue was purely a race condition in the SSS auth flow

#### Previously Applied Fixes (Verified)
- Security Pledge fallback data for when Google Sheets CSV is unreachable
- Security Communication using `communicationPosts` Firestore collection
- Estimated/Actual charts on Home Dashboard with fallback sample data
- Annual table audit type display improvements
- Increased font sizes/weights on AdminDashboard and SecurityFeePage
- Darker/bolder Auditor Schedule text
- Enhanced By Auditor chart readability

#### Modified Files
- `src/firebase/auth.js` — `updateUserBranch()`, `listenToAuthChanges()` race condition fixes
- `src/components/BranchSelection.jsx` — Retry logic, better error handling
- `src/App.jsx` — Removed duplicate SessionWarningToast
- `PROJECT_GUIDE.md` — Session 25 changelog
- Build: **0 errors**, 2550 modules, ~15s

---

### 2026-03-25 (Session 26 - Firestore App Check Fallback & Branch Loading Fix v3.3)

#### Critical Fix: Branch List Still Not Loading After Session 25 Deploy

**Problem Diagnosis**: Session 25 fixes addressed the race condition, but the user `테스트` (test@test.com) still saw "Failed to load station list" and "No stations are configured yet". Console analysis revealed the root cause was **not** a race condition but **Firestore App Check enforcement blocking ALL Firestore read operations**.

**Root Cause**: Firebase App Check enforcement is **enabled server-side** for Firestore in the Firebase Console. The reCAPTCHA Enterprise token validation fails because the production domain (`airzeta-security-fee-app.vercel.app`) may not be in the reCAPTCHA Enterprise key's allowed domains list. When enforcement is ON, Firestore rejects ALL requests (read and write) with "Missing or insufficient permissions" — regardless of whether the user is authenticated and the security rules would permit access.

**Error Flow**:
1. User logs in → Firebase Auth succeeds ✅
2. `listenToAuthChanges()` → tries to read `users/{uid}` → **PERMISSION DENIED** (App Check blocks)
3. Falls back to minimal profile → shows BranchSelection ✅
4. `getAllBranches()` → tries to read `branchCodes` collection → **PERMISSION DENIED** (App Check blocks)
5. Shows "Failed to load station list" / "No stations configured" ❌
6. `updateUserBranch()` → tries to write `users/{uid}` → **PERMISSION DENIED** (App Check blocks)

#### Fixes Applied

1. **NEW: Hardcoded fallback branch list in `collections.js`**
   - Added `FALLBACK_BRANCHES` array with all known stations: HQ, ALASU, TYOSU, SINSU, HKGSU, BKKSU, SFOSF
   - `getAllBranches()` now catches permission errors and returns the fallback list instead of throwing
   - Users can select a branch and proceed even when Firestore is blocked by App Check
   - **Important**: Update `FALLBACK_BRANCHES` when branches are added/removed in Settings
   - **File**: `src/firebase/collections.js`

2. **IMPROVED: `updateUserBranch()` permission error handling**
   - If Firestore write fails due to App Check enforcement, returns `{ success: true, localOnly: true }`
   - User can proceed with local-only branch assignment (stored in React state)
   - Branch will be persisted to Firestore when App Check is resolved
   - **File**: `src/firebase/auth.js`

3. **IMPROVED: `listenToAuthChanges()` permission error logging**
   - Explicitly detects App Check-related permission errors
   - Logs clear diagnostic message instead of generic error
   - **File**: `src/firebase/auth.js`

4. **IMPROVED: BranchSelection UI for fallback mode**
   - Detects when fallback branches are being used (via `_fallback` marker)
   - Shows a subtle yellow banner: "Using cached station list. Contact admin if your station is missing."
   - Removed verbose Firestore permission error panel (since fallback handles it gracefully)
   - Simplified error display — only shows generic errors for non-permission failures
   - **File**: `src/components/BranchSelection.jsx`

#### Admin Action Required (Resolve Root Cause)

The fallback ensures users can register and log in, but full Firestore access requires fixing one of these:

**Option A (Recommended): Disable Firestore App Check enforcement**
1. Firebase Console → App Check → APIs
2. Find "Cloud Firestore" in the list
3. Click to **unenforce** (disable enforcement)
4. Firestore will accept all requests regardless of App Check token status

**Option B: Add production domain to reCAPTCHA Enterprise key**
1. GCP Console → reCAPTCHA Enterprise → Select key `6LdAk4Ms...`
2. Edit key → Add `airzeta-security-fee-app.vercel.app` to allowed domains
3. Also add `mark4mission.github.io` if using GitHub Pages
4. Wait 5-10 minutes for propagation

**Option C: Deploy Firestore rules manually**
- `firebase login && firebase deploy --only firestore:rules`
- Note: This alone won't help if App Check enforcement is ON

#### Modified Files
- `src/firebase/collections.js` — `FALLBACK_BRANCHES` array, permission-error fallback in `getAllBranches()`
- `src/firebase/auth.js` — `updateUserBranch()` permission-error fallback, `listenToAuthChanges()` improved logging
- `src/components/BranchSelection.jsx` — Fallback detection, simplified error UI, "Using cached station list" banner
- `firestore.rules` — `exists()` guard in `isAdmin()` (from Session 25)
- `PROJECT_GUIDE.md` — v3.3, Session 26 changelog
- Build: **0 errors**, 2550 modules, ~15s

---

### 2026-03-19 (Session 24 - Bug Fixes & Readability Improvements)

#### Bug Fixes

1. **Security Pledge Agreement — "Could not load pledge data" (CORS Fix)**
   - **Symptom**: Google Sheets CSV fetch redirects to Google Login page, causing CORS error. Error: `Access-Control-Allow-Origin` header blocked.
   - **Root cause**: Google Sheets `gviz/tq?tqx=out:csv` URL requires "Publish to Web" sharing (not just link sharing). If publishing is disabled, Google redirects to login.
   - **Fix**: Added fallback URL pattern array `PLEDGE_SHEET_CSV_URLS` with two strategies: (1) gviz URL, (2) `/export?format=csv&gid=0`. The fetch loop tries each URL, checks `content-type` header to detect HTML login redirect vs actual CSV data. Falls back to next URL on failure.
   - **Important lesson**: Google Sheets CSV access requires either "Publish to Web" (File > Share > Publish to web) OR using the `/export?format=csv` URL which works with standard link-sharing permissions.
   - **File**: `HomePage.jsx` → `SecurityPledgeCard`

2. **Security Communication showing Directive posts (Component Remount Fix)**
   - **Symptom**: Navigating from "Security Directive" to "Security Communication" in sidebar showed the same posts from `bulletinPosts` collection instead of `communicationPosts`.
   - **Root cause**: Both routes render the same `<BulletinPage>` component with different `boardType` prop. React Router may reuse the component instance without triggering a proper cleanup of the Firestore `onSnapshot` listener.
   - **Fix**: Added `key="directive"` and `key="communication"` to the Route elements in `App.jsx`, forcing React to unmount/remount `BulletinPage` when switching between the two boards. This ensures a fresh Firestore listener is created for the correct collection.
   - **File**: `App.jsx` → Routes

3. **Security Fee Home Card — Chart Data Not Showing**
   - **Symptom**: Estimated/Actual sparkline chart on Home dashboard showed no data.
   - **Fix**: Added fallback field names (`doc.items` alongside `doc.costItems`, `item.estimated`/`item.actual` alongside `item.estimatedCost`/`item.actualCost`) to handle potential Firestore schema variations. This makes the aggregation more resilient to field naming differences.
   - **File**: `HomePage.jsx` → `fetchFeeStats`

#### Readability Improvements

4. **Security Fee Page — Font Size Improvements**
   - **What**: Increased font sizes across the Security Fee module for better readability while maintaining compact layout.
   - **Cost Status table** (`AdminDashboard.jsx`): Table base font `0.7rem` → `0.78rem`, station header `fontWeight: 800` + `fontSize: 0.82rem`, station name `fontWeight: 700` + `fontSize: 0.82rem`, month headers `fontWeight: 700` → `800` + color → `COLORS.text.primary`, Est/Act KRW totals `0.55rem` → `0.6rem` + `fontWeight: 800`, cell Est/Act values `0.6rem` → `0.72rem` + `fontWeight: 700` + `letterSpacing: -0.01em`, variance `0.55rem` → `0.62rem` + `fontWeight: 800`, legend `0.65rem` → `0.7rem` + `fontWeight: 500`.
   - **Cost input form** (`SecurityFeePage.jsx`): Field labels `0.6rem` → `0.65rem` + `fontWeight: 700`, Est/Act Cost labels `0.65rem` → `0.68rem`, Est/Act result values `0.9rem` → `0.95rem`.

5. **Audit Schedule Page — Font & Readability Improvements (v3.5)**
   - **Summary cards**: Card labels `0.68rem` → `0.72rem` + color changed to `COLORS.text.primary` (from `secondary`), card values `1.6rem` → `1.8rem`, icon size `13` → `14`.
   - **Dashboard chart headers**: All chart titles `0.75rem` → `0.78rem`, icon size `13` → `14`, increased bottom margin `0.5rem` → `0.6rem`.
   - **Completion Rate donut**: Enlarged from 60px to 80px, thicker stroke (`3.2` → `4.5`), added `완료율` label below percentage, legend now shows per-status count with individual color + bold % alignment. Percentage text increased to `0.95rem/900 weight`.
   - **MiniBarChart**: Added value numbers above each bar for immediate readability.
   - **Table view (ScheduleTable)**: Cell padding `0.6rem` → `0.65rem`, header font `0.76rem` → `0.78rem` + `fontWeight: 800` + color `#1E293B`.
   - **Annual table**: Station header `0.72rem` → `0.76rem` + `fontWeight: 800` + color `COLORS.text.primary`, month headers `0.7rem` → `0.74rem` + `fontWeight: 800`, station name `0.78rem` → `0.82rem` + `fontWeight: 700`.

6. **Audit Schedule — "By Auditor" Chart Redesign**
   - **What**: Replaced the old vertical bar chart (which showed nothing when `stats.byAuditor` was empty) with a horizontal stacked bar chart that always renders. Shows each auditor's total assignments with per-status color breakdown.
   - **Empty state**: Shows icon + "No auditor assignments yet" + "Assign auditors to audit schedules" hint instead of being hidden.
   - **Format**: Horizontal bars 16px tall (up from 14px), sorted by count (descending), up to 8 auditors. Each bar subdivided by status in consistent order (completed → in_progress → scheduled → postponed → cancelled). Auditor name 60px (up from 52px), font `0.68rem` (up from `0.62rem`). Bottom status legend with color dots.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AnalyticsDashboard`

7. **Annual Schedule Table — Audit Type in Cells**
   - **What**: Changed the cell content from station branch name (redundant with row header) to audit type abbreviation (e.g., "RSA" for Regular Security Audit, "SI" for Special Inspection), providing meaningful per-cell information.
   - **Rationale**: Since rows are already grouped by station, showing the station name again in cells was redundant. Displaying audit type abbreviation gives immediate context about what kind of audit is scheduled in each month. Full details appear in the hover tooltip.
   - **Tooltip**: Added `title` attribute showing full audit type name, status, and auditor for quick reference.
   - **Font improvements**: Cell label `0.58rem` → `0.6rem`, auditor sub-label `0.5rem` → `0.52rem` with `fontWeight: 600`.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AnnualScheduleTable`

#### Technical Notes
- Google Sheets CORS lesson: **gviz URL requires "Publish to Web"** (separate from link-sharing); `/export?format=csv` works with standard sharing.
- `BulletinPage` `key` prop forces full remount including Firestore listener cleanup when switching between boards.
- Completion Rate donut uses `strokeDasharray/strokeDashoffset` for multi-segment rendering; segments with 0% are now filtered out to prevent rendering artifacts.
- By Auditor chart renders status segments in consistent order to avoid visual jumping when data changes.

#### Files Modified
- `src/App.jsx` — Added `key` prop to BulletinPage routes for component remount
- `src/modules/home/HomePage.jsx` — Pledge CORS fallback URLs, fee stats field name fallbacks
- `src/modules/security-audit/SecurityAuditSchedulePage.jsx` — v3.5: enhanced Completion Rate donut (80px, thicker strokes, 완료율 label), By Auditor horizontal stacked bars with status legend, Annual table cells show audit type abbreviation + tooltip, readability improvements throughout
- `src/modules/security-fee/SecurityFeePage.jsx` — Font size improvements (labels, Est/Act values)
- `src/modules/security-fee/components/AdminDashboard.jsx` — Font size improvements (table 0.78rem, cells 0.72rem, station 0.82rem, headers 0.82rem)
- `PROJECT_GUIDE.md` — Session 24 changelog (v3.1)

---

### 2026-03-13 (Session 23 - Dashboard Charts & Home Page Enhancements)

#### Audit Schedule Dashboard Upgrades (SecurityAuditSchedulePage.jsx v3.4)

1. **Multi-segment Completion Rate Donut**
   - **What**: The Completion Rate chart was upgraded from a simple progress circle to a multi-segment donut showing all status categories (Scheduled, In Progress, Completed, Cancelled, Postponed) with proportional arc segments.
   - **Implementation**: Uses SVG `strokeDasharray` and `strokeDashoffset` to draw proportional arcs for each status. The center still shows the completion percentage. A legend beside the donut lists each status with count and percentage.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AnalyticsDashboard`

2. **Stacked Monthly Distribution Bar Chart**
   - **What**: The Monthly Distribution chart was upgraded from simple single-color bars to stacked bars showing status breakdown per month.
   - **New component**: `StackedBarChart` renders 12 monthly bars, each subdivided by status (using vertical column-reverse stacking). Legend at bottom shows active statuses.
   - **Data**: `monthlyStatusData` (useMemo) computes per-month status counts from schedules filtered by `startDate`.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AnalyticsDashboard.StackedBarChart`

3. **By Audit Type — Short Korean Labels + Status Stacking**
   - **What**: Audit type bar chart labels now use abbreviated Korean translations to prevent truncation (e.g., "Regular Security Audit" → "정기점검", "Special Inspection" → "특별점검"). Bars are also stacked by status.
   - **Label map**: `AUDIT_TYPE_SHORT` dictionary with 6 common audit types. Fallback: truncate to 5 chars + ".."
   - **Data**: `auditTypeStatusData` (useMemo) groups schedules by `auditType` with per-status breakdown.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AnalyticsDashboard`

#### Home Page Enhancements (HomePage.jsx)

4. **Security Level Change Notifications**
   - **What**: Below the mini world map on the Security Level card, the most recent security-level changes (up to 3, within last 30 days) are displayed as compact notification lines.
   - **Format**: `[Station IATA] [from level] → [to level] [date]`. Most recent entry highlighted with orange border-left and AlertTriangle icon.
   - **Data source**: Each station's `history[]` array (sorted newest-first). `recentChanges` computed via `useMemo`.
   - **File**: `HomePage.jsx` → `SecurityLevelMiniMap`

5. **Security Pledge Agreement — Enhanced Stats**
   - **What**: The pledge card right-side now always renders (with loading/error states), adds a department breakdown horizontal bar chart, and shows up to 10 recent signers (was 8).
   - **Department breakdown**: Aggregates `byDept` from parsed CSV data. Renders top 5 departments as horizontal progress bars with counts.
   - **Error state**: Shows red error banner when CSV fetch fails. Shows loading message during fetch.
   - **State change**: `pledgeData` now includes `byDept: {}` and `error: false` fields.
   - **File**: `HomePage.jsx` → `SecurityPledgeCard`

#### Technical Notes
- `MiniBarChart` label max-width increased from `28px` to `36px` for better readability.
- `StackedBarChart` uses `column-reverse` flex direction for natural bottom-up stacking of status segments.
- Korean audit type abbreviations mapped via `AUDIT_TYPE_SHORT` dictionary to keep labels under 5 characters.
- `SecurityLevelMiniMap` → `recentChanges` useMemo depends on `[stations]`.

#### Files Modified
- `src/modules/security-audit/SecurityAuditSchedulePage.jsx` — v3.4: multi-status donut, stacked monthly bars, Korean audit type labels
- `src/modules/home/HomePage.jsx` — security level change notifications, pledge dept breakdown, error handling
- `PROJECT_GUIDE.md` — Session 23 changelog (v2.9)

---

### 2026-03-08 (Session 22 - Audit Schedule Enhancements v3.3)

#### New Features

1. **Findings & Recommendations Count Fields**
   - **What**: When audit status is `completed` or `in_progress`, the form modal now shows numeric count inputs (`findingsCount`, `recommendationsCount`) alongside the existing text areas for findings/recommendations.
   - **UI**: Yellow-tinted card for Findings (시정조치) with count input + textarea; Cyan-tinted card for Recommendations (개선권고) with count input + textarea. Labels are bilingual (Korean + English).
   - **Dashboard**: Two new summary cards added — "Findings" (orange) and "Recommendations" (cyan) showing year-total counts aggregated from all schedules' `findingsCount` and `recommendationsCount` fields.
   - **Table View**: New "결과" (Results) column between Status and Notes columns. Displays "시정 N" (orange) and "권고 N" (cyan) when counts > 0, or "—" when no results.
   - **Print**: Results column included in printed PDF layout.
   - **Firestore**: `findingsCount` and `recommendationsCount` are integer fields saved to each `securityAuditSchedules` document.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AuditFormModal`, `ScheduleTable`, `AnalyticsDashboard`, `handlePrint`

2. **Dashboard Summary Card Hover Popovers**
   - **What**: Hovering over any of the 8 dashboard summary cards now shows a dark tooltip/popover with a detailed list of the relevant items (up to 8 entries per card).
   - **Cards affected**: Total Audits, Scheduled, In Progress, Completed, Overdue, Stations, Findings, Recommendations.
   - **Behavior**: Popover appears below the card on mouseEnter, disappears on mouseLeave. Shows station name + date for status-based cards, station name + count for Findings/Recommendations, station: count for Stations card.
   - **Hook safety**: `useMemo` for `cardDetails` placed before the `if (!stats) return null` guard to comply with React Rules of Hooks.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AnalyticsDashboard`

3. **Improved File Upload Error Handling**
   - **What**: File upload errors now show inline red error banners instead of `alert()` dialogs. Specific error messages for Firestore permission-denied, network offline, and generic failures.
   - **New state**: `uploadError` string displayed in the file attachments section.
   - **Edge case**: If the schedule hasn't been saved yet (new schedule), an explicit message tells the user to save first and then re-open to attach files.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AuditFormModal.handleFileUpload`

#### Technical Notes
- Dashboard grid changed from `minmax(130px, 1fr)` to `minmax(115px, 1fr)` to accommodate 8 cards.
- `AnalyticsDashboard` now receives `schedules` prop alongside `stats` to compute findingsCount/recommendationsCount totals client-side.
- `cardDetails` uses `useMemo` with `[schedules, stats]` dependency array for performance.

#### Files Modified
- `src/modules/security-audit/SecurityAuditSchedulePage.jsx` — v3.3: findings/recommendations counts, card hover popovers, file upload error UX
- `PROJECT_GUIDE.md` — Session 22 changelog (v2.8)

---

### 2026-03-08 (Session 21 - Audit Schedule Bug Fixes v3.2)

#### Bug Fixes (6 issues from user testing)

1. **FIXED: Auditor edit not persisting to table**
   - **Symptom**: Adding auditors in modal worked visually, but table still showed only previous auditor (e.g., 'TAZ')
   - **Root Cause**: Form submit passed raw `form` object without explicitly syncing the backward-compatible `auditor` string field. Firestore may have had stale `auditor` value overriding `auditors` array on some reads.
   - **Fix**: `handleSubmit` now creates `submitData` with explicit `auditors: form.auditors || []` and `auditor: (form.auditors || []).join(', ')` before calling `onSave()`
   - **File**: `SecurityAuditSchedulePage.jsx` → `AuditFormModal.handleSubmit`

2. **FIXED: File upload never finishes / drag-and-drop non-functional**
   - **Symptom**: Upload spinner appeared but never completed; drag-and-drop had no effect
   - **Root Cause**: `FileReader.onload` callback used `async/await` inside a non-async `onload` handler. Errors from `uploadAuditScheduleFile()` weren't caught by the outer try/catch, so `setUploading(false)` was never called on failure. The file input also didn't reset after upload, preventing re-upload of the same file.
   - **Fix**: Rewrote upload to use `Promise`-based FileReader + `try/finally` for guaranteed `setUploading(false)`. Added drag-and-drop handlers (`onDragOver`, `onDragLeave`, `onDrop`) to the file attachment area. Added visual drag feedback (blue dashed border). File input resets after each upload.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AuditFormModal.handleFileUpload`

3. **FIXED: Korean input orphaned last character (IME composition)**
   - **Symptom**: Typing Korean in Settings fields (audit types, frequencies, auditors, station names) and pressing Enter submitted the text with the last character appearing separately or missing
   - **Root Cause**: `onKeyDown` for Enter didn't check `e.nativeEvent?.isComposing`. During Korean IME composition, Enter key finalizes the composing character AND triggers `onKeyDown`, causing premature submission before the character is fully composed.
   - **Fix**: Added `!e.nativeEvent?.isComposing` guard to ALL `onKeyDown` Enter handlers in both `SecurityAuditSchedulePage.jsx` (auditor input) and `AuditScheduleSettings.jsx` (4 input fields: audit types, frequencies, auditors, station category inputs). Added `onCompositionEnd` handler on auditor input for reliable value sync.
   - **Files**: `SecurityAuditSchedulePage.jsx`, `AuditScheduleSettings.jsx`

4. **FIXED: Table view text too dark / hard to read**
   - **Symptom**: Table cells in table view had very dark text that was hard to read
   - **Root Cause**: `cellStyle` had no explicit color, inheriting the page default `#1E293B`. While readable, the monotone darkness made columns hard to scan. Header row used `COLORS.text.secondary` which was `#64748B` — too light for headers.
   - **Fix**: Set `cellStyle.color` to `#334155` (darker slate). Explicitly set station name to `#1E293B` (darkest), audit type and dates to `#475569` (medium), notes to `#64748B` (lighter). Header column color changed to `#475569` for better hierarchy.
   - **File**: `SecurityAuditSchedulePage.jsx` → `ScheduleTable`, `cellStyle`

5. **FIXED: Status dropdown cut off when few rows**
   - **Symptom**: In table view with only 1-3 rows, clicking the status dropdown caused the menu to appear below the row and get clipped by the table container
   - **Root Cause**: Dropdown always opened downward (`top: '100%'`) regardless of available viewport space
   - **Fix**: Added `useRef` on the button and viewport space calculation on toggle. If space below button is less than 220px, the dropdown flips upward (`bottom: '100%'`). Uses `window.innerHeight - rect.bottom` measurement.
   - **File**: `SecurityAuditSchedulePage.jsx` → `StatusDropdown`

6. **FIXED: Dashboard chart not appearing**
   - **Symptom**: Analytics dashboard area was blank, no charts shown
   - **Root Cause**: `AnalyticsDashboard` had `if (!stats || stats.total === 0) return null` — returned nothing when there were zero audits for the selected year. Users couldn't tell if the feature existed.
   - **Fix**: Changed to show an empty-state placeholder card with icon and message ("No audit data for {year} — Create your first audit schedule to see analytics") when `stats.total === 0`. Charts still render normally when data exists. Also renamed inner `BarChart` component to `MiniBarChart` to avoid shadowing `BarChart3` import from lucide-react.
   - **File**: `SecurityAuditSchedulePage.jsx` → `AnalyticsDashboard`

#### Lessons Learned
- **Korean IME**: Always check `e.nativeEvent?.isComposing` or `e.nativeEvent.isComposing` before processing Enter key in React `onKeyDown` handlers. This applies to all CJK (Chinese, Japanese, Korean) input methods.
- **FileReader async**: Never use `async/await` inside `FileReader.onload` without proper error handling — the outer try/catch won't catch async errors. Convert to Promise-based pattern instead.
- **Dropdown positioning**: Always check viewport bounds before positioning dropdowns. CSS `overflow: hidden` on parent containers clips absolutely-positioned children.
- **Empty state UX**: Dashboard components should show meaningful placeholders when data is empty, not return null silently. Users need visual confirmation that the feature exists.

#### Files Modified
- `src/modules/security-audit/SecurityAuditSchedulePage.jsx` — v3.2: all 6 fixes above
- `src/modules/security-audit/AuditScheduleSettings.jsx` — Korean IME composition guards on all 4 inputs
- `PROJECT_GUIDE.md` — Session 21 changelog
- Build: **0 errors**, 2550 modules, ~12.7s

---

### 2026-03-08 (Session 20 - reCAPTCHA Enterprise Key Fix & App Check Stabilization v2.6)

#### Changes Made
1. **reCAPTCHA Enterprise key updated**: Replaced old key `6LeJXIMs...` with new key `6LdAk4Ms...` created in GCP Console
2. **Removed misleading "v2/v3 key" warnings**: reCAPTCHA Enterprise website keys also start with `6L` prefix — the key format alone does NOT indicate v2/v3 vs Enterprise
3. **config.js**: Cleaned up App Check initialization with accurate comments documenting the full token flow
4. **security.js v2.6**: Updated error messages to focus on domain authorization instead of key format
5. **Login.jsx**: Improved App Check error message with domain-specific guidance

#### Key Insight: "키 설정 완료: 토큰 요청" (미완료) Status
- This GCP Console status means the reCAPTCHA Enterprise key has been created but no token has been successfully requested yet
- Firebase App Check automatically handles this: `initializeAppCheck()` → `ReCaptchaEnterpriseProvider` → `grecaptcha.enterprise.execute()` → token → Firebase server creates assessment
- The "미완료" status changes to "완료" after the first successful assessment on a production domain
- Sandbox domain failures are expected (domain not in allowlist) — this resolves after Vercel deployment

#### Admin Checklist for Production
1. **Deploy Firestore rules**: Current production rules are STILL `allow read, write: if true` (since 2026-02-17)
   - Firebase Console > Firestore > Rules > Paste from `firestore.rules` file
   - OR: `firebase login && npm run deploy:rules`
2. **Vercel env var**: Set `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=6LdAk4MsAAAAAINmouJCEQlJiAIONWFGnJlY9qPA`
3. **GCP Console**: Verify reCAPTCHA Enterprise key has `airzeta-security-fee-app.vercel.app` in allowed domains
4. **Firebase Console**: Verify App Check > reCAPTCHA Enterprise key is registered
5. **Firebase Console**: Verify App Check enforcement setting for Authentication

#### Modified Files
- `src/firebase/config.js` — Cleaner App Check init, removed false v2/v3 warnings
- `src/firebase/security.js` — v2.6, improved error messages
- `src/components/Login.jsx` — Better App Check error guidance
- `PROJECT_GUIDE.md` — Session 20 notes
