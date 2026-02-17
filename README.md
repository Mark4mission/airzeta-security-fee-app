# Branch Security Cost Submission System

A modern web application for managing and submitting branch security costs to Google Sheets.

## 🚀 Quick Deploy

**Built and ready to deploy!** The production build is in the `dist` folder.

### Fastest Deployment (1 minute):

```bash
# Option 1: Vercel (Recommended)
npm install -g vercel
vercel login
vercel --prod

# Option 2: Netlify Drop
# Just drag the 'dist' folder to: https://app.netlify.com/drop

# Option 3: Use deploy script
./deploy.sh
```

📖 **Full deployment guide**: See [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Features

✅ **Customizable Dropdowns**
- Branch Names
- Cost Item Names  
- Currencies
- Payment Methods

✅ **Data Management**
- Submit cost data to Google Sheets
- Load previous submissions (with branch code authentication)
- Edit and resubmit data
- Multiple cost items per submission

✅ **Security**
- Branch code authentication
- Password-protected data access

✅ **Modern UI**
- Responsive design
- Real-time cost calculation
- File upload support (PDF contracts)
- Settings management

---

## 🚨 IMPORTANT: Google Sheets Setup

### Why Data Isn't Being Submitted

The most common issue is **Google Apps Script configuration**. Follow these steps carefully:

### Step 1: Create Google Sheets

1. Open Google Sheets
2. Create a new spreadsheet
3. Name it (e.g., "Branch Security Costs")

### Step 2: Add Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code
3. Copy the entire code from `google-apps-script.js` file
4. Paste it into the Apps Script editor
5. **IMPORTANT**: If you have existing sheets with Korean headers, delete them first:
   - The script will create new sheets with English headers
   - Delete "Submissions" and "BranchCodes" sheets if they exist
   - The script will recreate them with correct English headers
6. Click **Save** (disk icon)

### Step 3: Deploy as Web App

This is the **CRITICAL** step that most people miss:

1. Click **Deploy** → **New deployment**
2. Click the **gear icon** ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure:
   - **Description**: "Branch Cost API" (or any name)
   - **Execute as**: **Me** (your email)
   - **Who has access**: **Anyone** ⚠️ IMPORTANT!
5. Click **Deploy**
6. **Authorize** the app (you'll see Google's permission screen)
   - Click your Google account
   - Click "Advanced" if you see a warning
   - Click "Go to [Project Name] (unsafe)" 
   - Click "Allow"
7. **COPY THE WEB APP URL** - It looks like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

### Step 4: Update Frontend

1. Open `src/App.jsx`
2. Find this line near the top:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/...';
   ```
3. **Replace with YOUR web app URL** from Step 3
4. Save the file

### Step 5: Test the Connection

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Submit a test form
4. Check the console logs for:
   - "Submitting data: {...}"
   - "Response status: 200"
   - "Response data: {status: 'success', ...}"

### Step 6: Verify in Google Sheets

1. Go back to your Google Sheet
2. You should see two new sheets:
   - **Submissions** - Contains all submitted data
   - **BranchCodes** - Contains branch code mappings

---

## Branch Code Management

### Default Branch Codes

The system creates sample branch codes in the `BranchCodes` sheet:

| Branch Name | Branch Code |
|------------|-------------|
| Seoul Branch | SEOUL2024 |
| Tokyo Branch | TOKYO2024 |
| New York Branch | NYC2024 |

### Adding New Branch Codes

1. Open your Google Sheet
2. Go to the **BranchCodes** sheet
3. Add a new row:
   - Column A: Branch Name (must match exactly)
   - Column B: Branch Code (password)

**Example:**
```
London Branch    LONDON2024
Singapore Branch SING2024
```

### Important Notes

- Branch codes are **case-sensitive**
- Branch name must **exactly match** what you select in the dropdown
- Each branch should have a **unique code**
- Share codes **securely** with branch managers

---

## Troubleshooting

### "Connection refused" Error

**Problem**: Can't connect to the app  
**Solution**: 
- Vite dev server needs `host: '0.0.0.0'` in `vite.config.js`
- This is already configured

### "Data not appearing in Google Sheets"

**Problem**: Form submits but no data in sheets  
**Causes**:
1. ❌ Apps Script not deployed as web app
2. ❌ Wrong access permissions (not set to "Anyone")
3. ❌ Wrong API URL in frontend
4. ❌ CORS not enabled

**Solution**: Follow the "Google Sheets Setup" section above

### "Invalid branch code" Error

**Problem**: Can't load previous data or submit  
**Solution**:
- Check the `BranchCodes` sheet in Google Sheets
- Verify branch name matches exactly (case-sensitive)
- Verify branch code is correct

### CORS Errors

**Problem**: Browser blocks the request  
**Solution**:
1. Ensure Apps Script is deployed as **Web App**
2. Set access to **Anyone**
3. Re-deploy after changes
4. The app will fallback to no-cors mode (data still sent)

### Testing API Connection

Use the test page:
```
https://your-app-url/test-api.html
```

This page:
- Tests CORS connection
- Tests no-cors fallback
- Shows detailed error messages
- Helps diagnose issues

---

## Google Apps Script Features

### Implemented Functions

1. **doPost(e)** - Handle data submissions
   - Validates branch code
   - Writes to Submissions sheet
   - Returns success/error response

2. **doGet(e)** - Handle data retrieval
   - Authenticates with branch code
   - Loads previous submissions
   - Returns data for editing

3. **verifyBranchCode()** - Authentication
   - Checks BranchCodes sheet
   - Validates credentials

4. **handleLoadRequest()** - Data loading
   - Filters by branch and month
   - Returns formatted data

### Sheet Structure

**Submissions Sheet** columns:
- Timestamp
- Branch Name
- Branch Code
- Manager Name
- Target Month
- Item Name
- Unit Price
- Currency
- Quantity
- Estimated Cost
- Actual Cost
- Basis
- Payment Method
- Contract File Name
- Note
- Submission ID

**BranchCodes Sheet** columns:
- Branch Name
- Branch Code

---

## Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

---

## Settings Management

### Accessing Settings

Click the **Settings** button (⚙️) in the header.

### Customizable Options

1. **Branch Names** - Add/remove branch locations
2. **Cost Item Names** - Define cost categories
3. **Currencies** - Add supported currencies
4. **Payment Methods** - Configure payment options

Settings are saved to browser's localStorage.

---

## Load Previous Data Feature

### How It Works

1. Select **Branch Name** from dropdown
2. Enter **Branch Code** (password)
3. Select **Target Month**
4. Click **"Load Previous Data"** button

### What Happens

- System authenticates with Google Sheets
- Loads your last submission for that month
- Pre-fills all form fields
- You can edit and resubmit

### Use Cases

- ✅ Fix typos or errors
- ✅ Add missing cost items
- ✅ Update actual costs after month-end
- ✅ Revise estimates

---

## Security Notes

⚠️ **Important Security Considerations**:

1. **Branch codes are NOT encrypted** - They're stored in plain text in Google Sheets
2. **Anyone with the sheet link can view data** - Use Google Sheets permissions to restrict access
3. **Apps Script runs with YOUR permissions** - Be careful who you share the sheet with
4. **No audit trail** - Consider adding timestamps and user tracking if needed

### Recommended Security Measures

1. **Share the Google Sheet only with authorized personnel**
2. **Use strong, unique branch codes**
3. **Rotate branch codes periodically**
4. **Enable Google Sheets version history**
5. **Consider using Google Workspace for additional security features**

---

## Tech Stack

- **Frontend**: React 19 + Vite 7
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Backend**: Google Apps Script
- **Database**: Google Sheets

---

## License

MIT

---

## Support

For issues with:
- **Frontend**: Check browser console (F12)
- **API Connection**: Use `/test-api.html` page
- **Google Sheets**: Check Apps Script logs (View → Logs)

---

## Quick Checklist

Before reporting issues, verify:

- [ ] Google Apps Script is deployed as Web App
- [ ] Access is set to "Anyone"
- [ ] Web app URL is correct in `src/App.jsx`
- [ ] Branch codes are added to BranchCodes sheet
- [ ] Branch name matches exactly (case-sensitive)
- [ ] Browser console shows no errors
- [ ] You've authorized the Apps Script app

---

**Made with ❤️ for efficient branch cost management**
