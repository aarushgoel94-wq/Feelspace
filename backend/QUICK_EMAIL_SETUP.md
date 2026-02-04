# Quick Email Setup Guide

## Problem: Reports aren't sending emails to feelspacemood@gmail.com

If you're not receiving emails when reports are submitted, follow these steps:

## Step 1: Set Up Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Enable 2-Factor Authentication (if not already enabled)
3. Go to App Passwords: https://myaccount.google.com/apppasswords
4. Select "Mail" and "Other (Custom name)"
5. Enter "Let It Out Backend" as the name
6. Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

## Step 2: Set Environment Variables

### Option A: Using .env file (Recommended)

1. Create a `.env` file in the `backend` directory:
   ```bash
   cd backend
   touch .env
   ```

2. Add these lines to `.env`:
   ```env
   EMAIL_USER=feelspacemood@gmail.com
   EMAIL_PASSWORD=your-16-character-app-password-here
   BASE_URL=http://localhost:3000
   ```

3. Replace `your-16-character-app-password-here` with the actual App Password (remove spaces)

### Option B: Using Terminal (Temporary)

```bash
export EMAIL_USER=feelspacemood@gmail.com
export EMAIL_PASSWORD=your-16-character-app-password
export BASE_URL=http://localhost:3000
```

## Step 3: Test Email Configuration

Run the setup script to test your email:

```bash
cd backend
node setup-email.js
```

This will:
- Test your email credentials
- Send a test email to feelspacemood@gmail.com
- Show you if there are any errors

## Step 4: Restart Backend Server

After setting environment variables, restart your backend server:

```bash
cd backend
npm start
```

You should see:
```
✅ Email service configured and verified successfully
   Sending emails to: feelspacemood@gmail.com
   From: feelspacemood@gmail.com
```

## Step 5: Resend Emails for Existing Reports

If you have existing reports that didn't get emails sent, you can resend them:

### Using the API:

```bash
# Get all reports
curl http://localhost:3000/reports

# Resend email for a specific report
curl -X POST http://localhost:3000/reports/REPORT_ID/resend-email
```

### Test Email Endpoint:

```bash
curl -X POST http://localhost:3000/test-email
```

## Troubleshooting

### "EMAIL_PASSWORD not configured"
- Make sure you set the `EMAIL_PASSWORD` environment variable
- Check that there are no spaces in the password
- Restart the server after setting the variable

### "EAUTH" Error
- Your App Password is incorrect
- Generate a new App Password and try again
- Make sure 2-Factor Authentication is enabled

### "ECONNECTION" or "ETIMEDOUT" Error
- Check your internet connection
- Gmail servers might be temporarily unavailable
- Try again in a few minutes

### Emails Still Not Arriving
1. Check spam/junk folder
2. Verify the email address is correct: `feelspacemood@gmail.com`
3. Check server logs for error messages
4. Test with the test endpoint: `POST /test-email`
5. Check if emails are being sent but not received (check server logs for "✅ Report email sent successfully")

## Verification

After setup, when a report is submitted, you should see in the server logs:

```
✅ Report [ID] email sent successfully to feelspacemood@gmail.com
   Message ID: [message-id]
```

If you see this, the email was sent successfully. If it's not in your inbox:
- Check spam folder
- Wait a few minutes (Gmail can have delays)
- Verify the email address is correct
