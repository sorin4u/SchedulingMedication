# Email Notification Setup Guide

## 📧 How to Enable Email Notifications

Your medication app now includes automatic email reminders! Follow these steps to set it up:

### 1. Gmail Setup (Recommended for Testing)

1. **Enable 2-Factor Authentication**
   - Go to your Google Account settings
   - Navigate to Security → 2-Step Verification
   - Enable it if not already enabled

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password

3. **Update .env File**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_FROM=Medication Reminder <your-email@gmail.com>
   ```

### 2. How It Works

The system automatically:
- Calculates doses based on your start time and frequency
- Sends email reminders at the right time
- Supports frequencies: every 4h, 6h, 8h, 12h, daily, etc.

**Example:**
- Start: Dec 22, 2025 at 8:00 AM
- Frequency: Every 6 hours
- Emails sent at: 8:00 AM, 2:00 PM, 8:00 PM, 2:00 AM (repeat)

### 3. Setting Up a Medication

1. Click "Add Medication"
2. Fill in:
   - **Name**: e.g., "Aspirin"
   - **Dosage**: e.g., "500mg"
   - **Frequency**: Select from dropdown (e.g., "Every 6 hours")
   - **Date & Time**: When you want to start
3. Save

The system will automatically send email reminders!

### 4. Testing

Send a test email:
```bash
# Use the API endpoint
POST /api/medications/:id/test-notification
```

Or restart your server and it will automatically start scheduling notifications.

### 5. Production Deployment (Render)

Add these environment variables in Render:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=Medication Reminder <your-email@gmail.com>
```

### 6. Alternative Email Services

**SendGrid:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**Mailgun:**
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=your-mailgun-username
EMAIL_PASSWORD=your-mailgun-password
```

### 7. Troubleshooting

- **No emails received?** Check spam folder
- **Authentication error?** Verify app password is correct
- **Still not working?** Check server logs for errors

The system checks every minute for scheduled doses and sends emails automatically!
