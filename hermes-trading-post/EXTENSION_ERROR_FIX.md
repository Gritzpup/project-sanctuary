# Browser Extension Error Fix

## The Error
```
Unchecked runtime.lastError: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
```

## What's Happening
This error is **NOT** from Hermes Trading Post. It's caused by a browser extension installed in your Chrome browser. The extension is injecting a script called `inject.js` that's not properly handling Chrome's message passing API.

## Solution Applied
I've added an extension error handler that:
1. Filters out these extension errors from the console
2. Logs them as warnings with helpful context instead
3. Identifies which extensions might be causing issues

## How to Find the Problematic Extension

### Method 1: Check Console Output
After refreshing the page, you'll see:
- Blue message: "[Extension Error Handler Active]"
- Orange messages showing which extension scripts are detected
- The errors will now show as warnings with instructions

### Method 2: Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to Sources tab
3. Look in the left panel for:
   - `inject.js`
   - Files under `chrome-extension://`
4. Click on the extension ID to see which extension it belongs to

### Method 3: Disable Extensions One by One
1. Go to `chrome://extensions`
2. Disable extensions one at a time
3. Refresh Hermes Trading Post after each disable
4. When the error stops, you've found the culprit

## Common Culprit Extensions
- Ad blockers
- Password managers
- Developer tools
- VPN extensions
- Shopping/coupon extensions

## Permanent Fix Options
1. **Keep the extension disabled** while using Hermes Trading Post
2. **Update the extension** to its latest version
3. **Report the issue** to the extension developer
4. **Use a different browser profile** for trading (no extensions)

## Note
The error handler I've added will keep your console clean and won't affect the functionality of Hermes Trading Post. The app will work perfectly fine despite these extension errors.