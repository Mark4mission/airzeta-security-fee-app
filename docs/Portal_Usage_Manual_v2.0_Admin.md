# Airzeta Station Security Portal — Administrator Usage Manual v2.0

**Version**: 2.0  
**Effective Date**: February 27, 2026  
**Audience**: HQ Administrators  
**Classification**: Internal Use Only

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
   - 2.1 Accessing the Portal
   - 2.2 Login & Authentication
   - 2.3 Understanding the Admin Role
3. [Home Dashboard](#3-home-dashboard)
   - 3.1 Welcome Banner
   - 3.2 Time Zone Display
   - 3.3 Module Quick-Access Cards
   - 3.4 Security Pledge QR Code
   - 3.5 Global Security News Feed
4. [Security Policy](#4-security-policy)
   - 4.1 Viewing the Policy
   - 4.2 Editing the Policy Text
   - 4.3 Uploading a PDF Version
   - 4.4 Printing the Policy
5. [Security Bulletin Board](#5-security-bulletin-board)
   - 5.1 Dashboard Overview
   - 5.2 Creating a New Post
   - 5.3 Rich Text & Markdown Editing
   - 5.4 File Attachments
   - 5.5 AI-Powered Translation
   - 5.6 Editing & Deleting Posts
6. [Security Fee Management](#6-security-fee-management)
   - 6.1 Admin Dashboard Overview
   - 6.2 Reviewing Branch Submissions
   - 6.3 Exchange Rates
   - 6.4 Contracts & Attachments
7. [Security Level — Global Map & Station Management](#7-security-level)
   - 7.1 Global Security Level Map
   - 7.2 Understanding the World Map
   - 7.3 Station Markers & IATA Codes
   - 7.4 Risk Tier Legend
   - 7.5 Station Cards
   - 7.6 Editing a Station's Security Level (Admin Support Mode)
   - 7.7 Managing Level Change History
   - 7.8 Deleting History Entries
8. [Important Links](#8-important-links)
   - 8.1 Browsing Links by Category
   - 8.2 Adding a New Link
   - 8.3 AI Metadata Generation
   - 8.4 Editing & Deleting Links
9. [Settings & Users](#9-settings-and-users)
   - 9.1 Settings Dashboard
   - 9.2 Managing Station List
   - 9.3 Cost Items, Currencies & Payment Methods
10. [Appendix](#10-appendix)
    - A. Keyboard Shortcuts
    - B. Supported Browsers
    - C. Troubleshooting

---

## 1. Overview

The **Airzeta Station Security Portal** is a unified web application designed for managing aviation cargo security operations across all Airzeta partner stations worldwide. As an HQ Administrator, you have full access to every module, including the ability to:

- Monitor and edit security levels for all stations via an interactive world map
- Publish and manage security bulletins with multi-language support
- Oversee security fee submissions and exchange rate data
- Maintain the company-wide security policy document
- Curate an important-links reference library
- Manage system settings, including station lists and cost configurations

The portal uses a dark-themed interface optimized for extended use, with responsive design for desktop and tablet screens.

---

## 2. Getting Started

### 2.1 Accessing the Portal

Open your web browser and navigate to the portal URL provided by your IT department. The portal runs on any modern browser (Chrome, Edge, Firefox, Safari).

### 2.2 Login & Authentication

1. On the login screen, enter your registered **email address** and **password**.
2. Click **Sign In**.
3. If your account has HQ Administrator privileges, you will be directed to the full admin view of the Home Dashboard.
4. If you see an "Access Restricted" message on certain pages, confirm with IT that your account role is set to `hq_admin`.

> **Tip**: Your role badge ("HQ Administrator") appears in the Welcome Banner on the Home page. If it shows "Station: [name]" instead, your account is configured as a branch user.

### 2.3 Understanding the Admin Role

As an admin, you can:

| Capability | Admin | Branch User |
|---|:---:|:---:|
| View Home Dashboard | ✅ | ✅ |
| View/Print Security Policy | ✅ | ✅ |
| Edit Security Policy Text | ✅ | ❌ |
| Upload Policy PDF | ✅ | ❌ |
| Create/Edit/Delete Bulletin Posts | ✅ | ❌ |
| Security Fee — Admin Dashboard | ✅ | ❌ |
| Security Fee — Submit Branch Costs | ✅ | ✅ |
| Security Level — Global Map View | ✅ | ❌ |
| Security Level — Edit Any Station | ✅ | ❌ |
| Security Level — Edit Own Station | ✅ | ✅ |
| Important Links — Add/Edit/Delete | ✅ | ❌ |
| Settings & Users | ✅ | ❌ |

---

## 3. Home Dashboard

The Home page is the landing page after login and serves as a central hub.

### 3.1 Welcome Banner

Displays your name, role badge ("HQ Administrator"), the current date, and a personalized greeting.

### 3.2 Time Zone Display

Below the welcome banner, three time zone clocks are shown:

- **UTC** — Coordinated Universal Time
- **KST** — Korea Standard Time (Asia/Seoul)
- **Local** — Your browser's local time zone

These update automatically every minute.

### 3.3 Module Quick-Access Cards

Three clickable module cards provide one-click navigation:

| Module | Description |
|---|---|
| **Security Bulletin Board** | View latest posts and publish announcements |
| **Security Fee Management** | Review submissions, manage exchange rates |
| **Security Level** | Interactive world map and station-level management |

Each card shows a status badge and, for the Bulletin Board card, previews the three most recent post titles.

### 3.4 Security Pledge QR Code

A QR code is displayed that links to the Airzeta Security Agreement page. Users can scan this QR code with their mobile device or click the **View Pledge** button to open it in a centered modal window with an "Open in new tab" option.

### 3.5 Global Security News Feed

The lower section of the Home page displays an automatically refreshing feed of global aviation security news, providing contextual industry updates.

---

## 4. Security Policy

Navigate to **Security Policy** from the sidebar.

### 4.1 Viewing the Policy

The policy document is displayed in a formatted, readable layout with:

- Title headers (auto-detected from UPPERCASE text)
- Numbered section headings (e.g., "1. PURPOSE") highlighted in blue
- Bullet-point lists with proper indentation
- Metadata lines (Version, Effective Date) in italic

### 4.2 Editing the Policy Text

1. Click the **Edit Policy** button (visible only to admins) in the page header.
2. A full-height text editor appears with the current policy content.
3. Make your changes using plain text with formatting conventions:
   - ALL CAPS lines become titles
   - Lines starting with "1. ", "2. " etc. become section headers
   - Lines starting with "- " become bullet points
4. Click **Save Policy** to persist changes to the database.
5. Click **Cancel** to discard edits.

### 4.3 Uploading a PDF Version

1. In the "Official Policy Document (PDF)" section, click **Upload PDF**.
2. Select a PDF file (max 50 MB).
3. The file is uploaded to cloud storage and the download link appears automatically.
4. All users can then download the official PDF by clicking the green **Download** button.

### 4.4 Printing the Policy

Click the **Print** button in the header to open your browser's native print dialog, which will print the formatted policy content section.

---

## 5. Security Bulletin Board

Navigate to **Security Bulletin** from the sidebar.

### 5.1 Dashboard Overview

The bulletin board lists all published security announcements. Posts are displayed with:

- Title, author, and creation date
- Preview snippet of the content
- Click any post to view its full details

### 5.2 Creating a New Post

1. Click the **Write** button to open the post editor.
2. Enter a **Title** for the bulletin post.
3. Compose the post body using either the Rich Text editor or Markdown mode.

### 5.3 Rich Text & Markdown Editing

**Rich Text Mode** (default):
- Use the toolbar to apply formatting (bold, italic, headings, lists, etc.)
- Insert tables using the table tool
- Embed code blocks using the code button

**Markdown Mode**:
- Toggle the **Markdown** button to switch to a plain-text Markdown editor
- Use standard Markdown syntax (headers, bold, lists, code fences, etc.)
- Click the **Preview** toggle to see a rendered preview alongside the editor

### 5.4 File Attachments

- Click the **Attach Files** button (paperclip icon) to upload supporting documents
- Supported formats include PDF, images, and Office documents
- Uploaded files appear in the attachment list below the editor
- Click **X** next to any file to remove it before publishing

### 5.5 AI-Powered Translation

The bulletin editor includes a built-in AI translation feature:

1. Write your post in any language.
2. Click the **Languages** dropdown to select a target language (Korean, English, Japanese, Chinese, German, French, Spanish, Arabic, Thai, Vietnamese).
3. Click the translate button to generate a translation of the entire post.
4. The translated content appears in a separate panel for review.
5. The portal auto-detects whether the original content is Korean or English.

### 5.6 Editing & Deleting Posts

- Open any post and click **Edit** to modify its content.
- All editing features (rich text, markdown, translation, attachments) are available when editing.
- To delete a post, use the delete option on the post detail page.

---

## 6. Security Fee Management

Navigate to **Security Fee** from the sidebar.

### 6.1 Admin Dashboard Overview

As an admin, you see the **Admin Dashboard** with:

- Summary cards showing total stations, cost items, currencies, and payment methods
- Aggregated views of submissions across all branches
- Filter and search capabilities

### 6.2 Reviewing Branch Submissions

- Browse submissions by station/branch
- View detailed cost breakdowns for each submission
- Review monthly budget tracking and cost comparisons
- Export or download data as needed

### 6.3 Exchange Rates

- Upload exchange rate data for currency conversions
- Rates are stored by year and accessible to all branches
- Ensure rates are updated regularly for accurate cost calculations

### 6.4 Contracts & Attachments

- Upload and manage contract files for each branch
- Attach supporting documents to fee submissions
- All files are stored securely in cloud storage

---

## 7. Security Level — Global Map & Station Management

Navigate to **Security Level** from the sidebar. As an admin, you see the **Global Security Level Overview**.

### 7.1 Global Security Level Map

The admin view presents an **interactive world map** rendered using real geographic data (Natural Earth TopoJSON). The map shows:

- Realistic country boundaries and coastlines
- A dark oceanic theme with subtle latitude/longitude grid lines
- Color-coded airport markers for each station

### 7.2 Understanding the World Map

The map uses a **Mercator projection** to display station locations accurately. Key features include:

- **Country outlines** drawn from TopoJSON data (Natural Earth, 110m resolution)
- **Ocean gradient** background with grid reference lines
- **Zoom-on-hover** behavior for station markers

### 7.3 Station Markers & IATA Codes

Each station is positioned on the map using its **IATA three-letter airport code**, extracted from the first three characters of the branch name:

| Branch Name | IATA Code | Airport |
|---|---|---|
| HANSF | HAN | Hanoi (Noi Bai) |
| ICNGSA | ICN | Seoul/Incheon |
| NRTSF | NRT | Tokyo/Narita |
| BKKCGO | BKK | Bangkok |

Markers include:

- **Pulsing animation** — a subtle ring pulses outward from each marker
- **Glow halo** — the marker has a colored halo matching its risk tier
- **IATA label** — the three-letter code is displayed above each marker
- **Hover tooltip** — hover over any marker to see:
  - Station code and city name
  - Current security level name
  - Effective date
  - "Click to edit configuration" prompt

### 7.4 Risk Tier Legend

Below the map, a legend explains the color coding:

| Color | Tier | Meaning |
|---|---|---|
| 🟢 Green | Safe / Normal | Low risk — standard security procedures |
| 🟠 Orange | Caution / Elevated | Moderate risk — enhanced screening |
| 🔴 Red | Alert / High | High risk — maximum security measures |

Color determination logic:
1. If the station's active level has an explicit color set, that color determines the tier.
2. Otherwise, the tier is calculated based on the active level's position relative to the total number of levels (lower index = safer).

Header badges show aggregate counts: e.g., "5 Safe", "2 Caution", "1 Alert".

### 7.5 Station Cards

Below the map, a grid of **station cards** shows all registered stations:

- **Station code** (IATA) and city name
- **Current level** badge (colored pill)
- **Effective date** ("Since YYYY-MM-DD")
- **Mini level bar** — a segmented horizontal bar showing all levels with the active level highlighted
- **"Edit Configuration"** link

**Unmapped Stations**: If any station's IATA code is not in the known airports database, a warning banner appears listing them (e.g., "2 stations not shown on map: XXXYY, ZZZWW").

### 7.6 Editing a Station's Security Level (Admin Support Mode)

This feature allows you to provide remote support to any station:

1. **Click any station card** or **click a map marker** to open that station's Security Level configuration screen.
2. The view is identical to what the branch user sees, with an additional **"ADMIN EDIT"** badge in the header.
3. You can:
   - Change the **current threat level** by clicking a different level button
   - Adjust the **effective date**
   - Edit **level names** (add/remove levels)
   - Optionally assign **colors** (toggle "Colors (Optional)")
   - Edit **action guidelines** for each level
   - View and manage the **Level Change History**
4. Click **Save Configuration** to persist all changes.
5. Click **← Back to Global Overview** to return to the world map.

> **Important**: Changes made in Admin Edit mode are saved directly to the station's configuration in the database. Exercise caution — all changes take effect immediately.

### 7.7 Managing Level Change History

The Level Change History section (collapsible) records every time a station's active security level is changed:

- Each entry shows: **date**, **from level → to level** (with color-coded text)
- Entries are sorted newest-first
- A badge displays the total number of recorded changes
- The history persists across sessions and is saved to the database

### 7.8 Deleting History Entries

To correct a mistaken entry or clean up test data:

1. Expand the **Level Change History** section (click the header to toggle).
2. Locate the entry you want to remove.
3. Click the **trash icon** (🗑) to the right of that entry.
4. A confirmation dialog appears: "Delete this history entry?"
5. Click **OK** to confirm deletion, or **Cancel** to keep the entry.
6. Click **Save Configuration** to persist the deletion to the database.

> **Note**: Deleted history entries cannot be recovered after saving. Review entries carefully before deleting.

---

## 8. Important Links

Navigate to **Important Links** from the sidebar.

### 8.1 Browsing Links by Category

Links are organized into five color-coded categories:

| Category | Color | Icon |
|---|---|---|
| Regulatory & Compliance | Red | 📋 |
| Training & Education | Amber | 🎓 |
| Industry & News | Blue | 🌐 |
| Tools & Resources | Green | 🔧 |
| General | Purple | 📌 |

Each category appears as a collapsible section with a count badge. Click the section header to expand or collapse it.

**Clicking a link card** opens the URL in a new browser tab. The entire card area is clickable — you do not need to find a specific link icon. Each card displays:

- Title (primary text, bright white)
- English description
- Korean description (displayed in bright, readable text for visibility)
- Category badge
- External link icon

### 8.2 Adding a New Link

1. Click the **Add Link** button in the page header.
2. Enter the **URL** (required).
3. Optionally enter a **Title** — or leave blank and let the AI fill it in.
4. Click the **✨ AI Generate** button to automatically:
   - Generate a title (if empty)
   - Detect the best category
   - Write English and Korean descriptions
5. Review and adjust the generated metadata as needed.
6. Select or confirm the **Category** from the dropdown.
7. Click **Save** to add the link.

### 8.3 AI Metadata Generation

The portal uses the Gemini AI model to analyze URLs and generate:
- Concise title (max 60 characters)
- Automatic category classification
- Two-sentence English description
- Two-sentence Korean description

This dramatically speeds up link curation and ensures consistent formatting.

### 8.4 Editing & Deleting Links

- Click the **Edit** (pencil) button on any card to modify its details.
- Click the **Delete** (trash) button to remove a link.
- Edit and Delete buttons are positioned on the card without interfering with the card's click-to-open behavior.

---

## 9. Settings & Users

Navigate to **Settings & Users** from the sidebar (admin-only).

### 9.1 Settings Dashboard

The settings page displays summary cards showing counts for:

- **Stations** — number of registered branches
- **Cost Items** — configured security cost categories
- **Currencies** — supported currencies for fee submissions
- **Payment Methods** — accepted payment types

### 9.2 Managing Station List

1. Click **Open Settings Manager** to open the configuration modal.
2. In the Stations/Branches section, you can:
   - Add new stations (with branch names matching IATA codes, e.g., "ICNGSA", "HANSF")
   - Remove stations that are no longer active
   - Edit station names

> **Important for Security Level Map**: The first three letters of each branch name are used as the IATA airport code to position markers on the world map. Ensure branch names start with valid IATA codes.

### 9.3 Cost Items, Currencies & Payment Methods

- **Cost Items**: Define the categories of security costs that branches submit (e.g., screening equipment, personnel, training).
- **Currencies**: Manage the list of accepted currencies (USD, EUR, KRW, JPY, SGD, etc.).
- **Payment Methods**: Configure payment types (Bank Transfer, Credit Card, Cash, etc.).

Settings are saved to both local storage and Firestore for persistence.

---

## 10. Appendix

### A. Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Navigate modules | Click sidebar links |
| Toggle sidebar | Click the chevron arrow |
| Close modal/dialog | Press `Escape` or click outside |
| Print security policy | Use the Print button, then `Ctrl+P` |

### B. Supported Browsers

| Browser | Minimum Version |
|---|---|
| Google Chrome | 90+ |
| Microsoft Edge | 90+ |
| Mozilla Firefox | 88+ |
| Safari | 14+ |

### C. Troubleshooting

| Issue | Resolution |
|---|---|
| "Access Restricted" message | Confirm your account role is `hq_admin` in Settings |
| Map markers not appearing | Check that branch names start with valid 3-letter IATA codes |
| AI translation not working | Verify that the Gemini API key is configured in environment variables |
| Security Level not saving | Check internet connection; look for console errors |
| QR code not scanning | Ensure camera is focused; try opening the pledge URL manually |
| Map countries not rendering | Check that `countries-110m.json` is in the `public/` folder |
| Unmapped stations warning | Add the missing IATA code to the `AIRPORT_COORDS` table in the code |

---

*This manual is maintained by the Airzeta HQ Security Operations team. For questions or feedback, contact the portal administrator or post in the Security Bulletin Board.*

*Document ID: AZSP-ADMIN-MANUAL-v2.0*  
*Last Updated: 2026-02-27*
