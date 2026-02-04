# Email Setup for Report Notifications

This guide explains how to set up email notifications for content reports.

## Overview

When a user reports content, the system automatically sends an email to `feelspacemood@gmail.com` with:
- Report details (ID, reason, description)
- Reported vent content
- Reported user handle
- Action buttons to block the user or dismiss the report

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Email Service

For Gmail, you'll need to:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Let It Out Backend" as the name
   - Copy the generated 16-character password

3. **Set Environment Variables**:

Create a `.env` file in the `backend` directory:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=feelspacemood@gmail.com
EMAIL_PASSWORD=your-16-character-app-password
BASE_URL=http://localhost:3000
```

For production, set these as environment variables on your hosting platform.

### 3. Alternative Email Services

You can use other email services by modifying the transporter configuration in `server.js`:

**SendGrid:**
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});
```

**Mailgun:**
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  auth: {
    user: process.env.MAILGUN_SMTP_USER,
    pass: process.env.MAILGUN_SMTP_PASSWORD,
  },
});
```

## How It Works

1. **User Reports Content**: When a user reports a vent, the report is saved to the database
2. **Email Sent**: An email is automatically sent to `feelspacemood@gmail.com` with:
   - Complete report details
   - The reported vent content
   - Two action buttons (Block User / No Action)
3. **Action Links**: Each email contains secure, one-time-use tokens that expire in 7 days
4. **Blocking**: Clicking "Block User" will:
   - Delete the reported vent
   - Remove all comments and reactions
   - Log the action
5. **No Action**: Clicking "No Action Needed" marks the report as reviewed

## Security Features

- **Secure Tokens**: Action links use cryptographically secure random tokens
- **One-Time Use**: Each token can only be used once
- **Expiration**: Tokens expire after 7 days
- **Token Verification**: All actions are verified before execution

## Testing

To test the email functionality:

1. Start the backend server:
   ```bash
   npm start
   ```

2. Submit a report through the app or API:
   ```bash
   curl -X POST http://localhost:3000/reports \
     -H "Content-Type: application/json" \
     -d '{
       "ventId": "test-vent-id",
       "reason": "Inappropriate content",
       "description": "Test report",
       "deviceId": "test-device-id"
     }'
   ```

3. Check the email inbox for the notification

## Troubleshooting

### Email Not Sending

1. **Check Environment Variables**: Ensure `EMAIL_PASSWORD` is set correctly
2. **Check Gmail App Password**: Verify the app password is correct and not expired
3. **Check Logs**: Look for error messages in the server console
4. **Test Connection**: The server will log "Email service configured" on startup if successful

### Action Links Not Working

1. **Check BASE_URL**: Ensure `BASE_URL` environment variable matches your server URL
2. **Check Token Expiration**: Tokens expire after 7 days
3. **Check Token Usage**: Each token can only be used once

## Production Considerations

1. **Use Environment Variables**: Never hardcode email credentials
2. **Use a Production Email Service**: Consider SendGrid, Mailgun, or AWS SES for better deliverability
3. **Store Tokens in Database**: For production, store action tokens in a database instead of memory
4. **Add Rate Limiting**: Implement rate limiting for the action endpoint
5. **Add Logging**: Log all email actions for audit purposes
6. **Use HTTPS**: Ensure action links use HTTPS in production



