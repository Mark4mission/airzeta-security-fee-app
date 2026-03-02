# AirZeta Security Portal - Project Guide

> **Document Version**: 1.2
> **Last Updated**: 2026-03-02
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
| Google Gemini AI | @google/genai ^1.43.0 | AI translation (gemini-2.5-flash-lite model) |

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
      config.js                   # Firebase app initialization
      auth.js                     # Auth helper functions
      collections.js              # Firestore collection references
    
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
      
      settings/
        SettingsPage.jsx          # App settings and user management
```

---

## 5. Firestore Collections

| Collection | Purpose | Key Fields |
|-----------|---------|------------|
| `users` | User accounts | uid, email, role, branchName, displayName |
| `branchCodes` | Registered branch stations | (doc ID = branch name) |
| `bulletinPosts` | Security directives | title, content, authorId, authorName, authorRole, attachments, acknowledgedBy[], viewCount, createdAt |
| `bulletinPosts/{id}/comments` | Comments on posts | text, authorId, authorBranch, authorRole, createdAt |
| `securityLevels` | Per-station security config | branchName, levels[], activeLevel, activeSince, guidelines[], history[], updatedAt, updatedBy |
| `securityFees` | Fee data | (branch-specific fee records) |
| `securityPolicies` | Policy documents | (policy content) |
| `importantLinks` | Important links | url, title, category, order |
| `documentLibrary` | Document Library (SSOP) | title, description, category, iataCode, downloadPermission, pinned, attachments[], uploaderId, uploaderEmail, uploaderBranch, uploaderRole, downloadCount, downloadLog[], createdAt, updatedAt |

---

## 6. Key Features & Implementation Details

### 6.1 Security Level Module
- **World Map**: TopoJSON rendering via custom SVG projection (Robinson-like Mercator)
- **IATA Codes**: First 3 letters of branchName map to AIRPORT_COORDS dictionary
- **Risk Tiers**: Safe (#22c55e) / Caution (#f97316) / Alert (#ef4444)
- **History**: Level changes are recorded ONLY when "Save Configuration" is clicked (not on UI selection)
- **History Date**: Uses the "Effective Since" date field, not today's date

### 6.2 Document Library Module (NEW - v1.2)
- **Purpose**: Station Security Operation Manuals (SSOP) & reference documents
- **Firestore Collection**: `documentLibrary`
- **File Storage**: Firebase Storage under `document_library/` path
- **Upload Limit**: 100 MB per file
- **Title Format**: `[IATA Code] (Category) Document Title` - e.g. `[ICN] (Regulation) SSOP Manual v3`
- **Categories**: Regulation, Guideline, Material, General, Other (color-coded badges)
- **Download Permission**: Radio buttons - "Admin Only" or "All Branches"
  - Uploader's branch ALWAYS has access automatically
  - Admin users ALWAYS have access
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

### 6.5 Routing
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

## 10. Changelog / Work History

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
The `SecurityLevelPage.jsx` contains an `AIRPORT_COORDS` object mapping IATA 3-letter codes to `{lat, lng, city}` for 55+ airports worldwide. New stations can be added by including their IATA code in this dictionary.

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
