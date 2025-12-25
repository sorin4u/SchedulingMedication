# Email Reminder System - How It Works

## Overview
The medication scheduling app automatically sends email reminders based on the frequency you select (e.g., Every 6 hours). This document explains how the system works and how to verify it's functioning correctly.

## How Email Reminders Work

### 1. **Automatic Scheduler**
- The server runs a background task **every minute** that checks all medications
- For each medication with a frequency set (like "Every 6 hours"), it calculates if it's time to send a reminder
- The scheduler logs detailed information to help you track what's happening

### 2. **Frequency Options**
When you select a frequency, the system will send emails at these intervals:
- **Every 4 hours** → Email every 4 hours
- **Every 6 hours** → Email every 6 hours  
- **Every 8 hours** → Email every 8 hours
- **Every 12 hours** → Email every 12 hours
- **Twice daily** → Email every 12 hours
- **Three times daily** → Email every 8 hours
- **Four times daily** → Email every 6 hours
- **Once daily** → Email every 24 hours

### 3. **Example: Every 6 Hours**
If you set a medication to "Every 6 hours" with a start time of 8:00 AM:
- **8:00 AM** - First email sent
- **2:00 PM** - Second email sent (6 hours later)
- **8:00 PM** - Third email sent (6 hours later)
- **2:00 AM** - Fourth email sent (6 hours later)
- And the cycle continues...

### 4. **Last Notification Tracking**
- The system tracks when the last email was sent in the `last_notification_sent` field
- This prevents duplicate emails from being sent
- You can see "Last Reminder" on each medication card to verify when the last email was sent
- The system won't send another email within 30 minutes of the last one (prevents duplicates)

## How to Set Up Email Reminders

### Step 1: Add or Edit Medication
1. Click "Add Medication" button
2. Fill in the medication details:
   - **Name**: Name of the medication
   - **Email**: Email address where reminders should be sent
   - **Dosage**: How much to take
   - **Frequency**: Select "Every 6 hours" (or your preferred frequency)
   - **Date & Time**: When you want to start the schedule
   - **Quantity Left**: Number of pills remaining

### Step 2: Verify Setup
After saving, check that your medication card shows:
- ✅ **Email Reminders**: 📧 Every 6 hours
- ✅ **Last Reminder**: (Will show timestamp after first email is sent)

### Step 3: Monitor Emails
- The scheduler runs every minute and checks if it's time to send
- When an email is sent, you'll see it in the server logs
- The "Last Reminder" field on the card will update with the timestamp

## Verification & Testing

### Check Server Logs
The server logs detailed information about the scheduler:

```
⏰ Scheduler running at: 12/25/2025, 2:00:00 PM
📋 Found 1 medication(s) with schedules

📧 ====== SENDING EMAIL REMINDER ======
   Medication: Aspirin
   Frequency: Every 6 hours
   To: user@example.com
   Pills Left: 25
   Last Notification: 12/25/2025, 8:00:00 AM
   Time Since Last: 360 minutes
======================================

✅ Email sent successfully and timestamp updated for Aspirin
```

### Test Email Manually
You can test the email system without waiting:
1. Open browser console
2. Call the test endpoint (or add a "Test Email" button in the UI)

### Verify Last Notification Sent
The medication card displays:
- **Last Reminder**: Shows exactly when the last email was sent
- This helps you verify the scheduler is working correctly

## Email Content

Each reminder email includes:
- 💊 Medication name
- Dosage information
- Frequency schedule
- **Pills Left** with color coding:
  - 🟢 Green if >10 pills
  - 🟠 Orange if 6-10 pills
  - 🔴 Red if ≤5 pills
- ⚠️ **Low Stock Alert** if pills ≤5

## Troubleshooting

### Emails Not Being Sent?

1. **Check Email Configuration** (.env file):
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   ```

2. **Verify Medication Has All Required Fields**:
   - ✅ Email address is filled in
   - ✅ Frequency is selected
   - ✅ Start date/time is set
   - ✅ Start time is not in the future

3. **Check Server Logs**:
   - Look for "Medication notification scheduler started"
   - Look for "📧 Sending notification" messages
   - Check for any error messages

4. **Verify Server is Running**:
   ```bash
   npm run dev
   ```
   Should show: "🚀 Server running on http://0.0.0.0:3000"

### Duplicate Emails?
The system has built-in protection:
- Won't send another email within 30 minutes of the last one
- The 1-minute detection window ensures emails are sent on time
- Last notification timestamp is updated after each send

## Technical Details

### Database Field
- `last_notification_sent` (TIMESTAMP) - Stores when the last email was sent
- Updated automatically by the scheduler
- Can be queried to verify email history

### Scheduler Logic
1. Runs every minute (cron: `* * * * *`)
2. Calculates time since medication start
3. Uses modulo operation to check if current time matches schedule
4. Prevents duplicates by checking last notification time
5. Sends email and updates timestamp

### API Endpoints
- `GET /api/medications/:id/notification-status` - Check notification status
- `POST /api/medications/:id/test-notification` - Send test email
- `GET /api/medications/:id/schedule` - View scheduled doses

## Example Workflow

1. **User adds medication**:
   - Name: "Vitamin D"
   - Email: "john@example.com"
   - Frequency: "Every 6 hours"
   - Start: Today at 9:00 AM

2. **Scheduler activates**:
   - 9:00 AM - First email sent ✅
   - 9:01 AM - Scheduler checks, but last email was <30 min ago, skips
   - 3:00 PM - Six hours passed, sends email ✅
   - 9:00 PM - Six hours passed, sends email ✅

3. **User verification**:
   - Card shows "Last Reminder: 9:00 PM"
   - Email inbox shows all reminders received
   - Pills left decreases when marked as taken

---

**Need Help?** Check the server console logs for detailed scheduler information.
