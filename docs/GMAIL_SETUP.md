# Gmail SMTP Setup Guide

TermuxHost uses Gmail SMTP via Nodemailer to send verification emails and password reset codes. You must use a **Gmail App Password**, not your regular Gmail password.

## Why App Passwords?

Google blocks regular password login for third-party apps when 2-Step Verification is enabled. App Passwords are 16-character tokens that bypass this restriction securely.

## Step 1: Enable 2-Step Verification

1. Go to https://myaccount.google.com
2. Click **Security** in the left sidebar
3. Under "How you sign in to Google", click **2-Step Verification**
4. Follow the setup steps if not already enabled

## Step 2: Create an App Password

1. Go to https://myaccount.google.com/apppasswords
   (Or: Google Account → Security → 2-Step Verification → scroll to bottom → App passwords)
2. In the **App name** field, type: `TermuxHost`
3. Click **Create**
4. Google shows a 16-character password like: `abcd efgh ijkl mnop`
5. **Copy this password now** — it won't be shown again

## Step 3: Add to Backend .env

```bash
nano ~/termuxhost/backend/.env
```

Set these two variables:
```
EMAIL_USER=your.gmail.address@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

> The spaces in the app password are fine — include them exactly as shown, or remove them. Both work.

## Step 4: Test Email Sending

Start the backend and try registering a new account. You should receive a verification email within a few seconds.

If no email arrives, check:
```bash
pm2 logs termuxhost | grep -i email
```

## Alternative: Use Gmail Less Secure Apps (Not Recommended)

If you don't want to use 2-Step Verification, you can enable "Less secure app access":
1. Go to https://myaccount.google.com/lesssecureapps
2. Turn it ON

> ⚠️ Google may disable this option and it reduces your account security. App Passwords are strongly preferred.

## Troubleshooting

**"Invalid login" / "535 Authentication Failed":**
- Make sure you're using an App Password, not your regular Gmail password
- Verify `EMAIL_USER` is your full Gmail address (including `@gmail.com`)
- Check 2-Step Verification is enabled before creating App Passwords
- Try deleting and recreating the App Password

**"Connection timeout" on sending:**
- Gmail SMTP works over port 465 (SSL) and 587 (TLS)
- On some mobile networks, outbound SMTP is blocked
- Try a different network or use a VPN

**Emails going to spam:**
- This can happen with new Google accounts
- Add a reply-to address and proper sender name
- For production, consider a dedicated email service like Resend or Mailgun

**"Less secure app access" option not visible:**
- This option is hidden when 2-Step Verification is enabled
- Use App Passwords instead (the correct method)

## Email Templates

The backend sends two types of emails:
- **Verification email** — sent after registration with a 6-digit code (expires in 15 minutes)
- **Password reset email** — sent after "Forgot Password" with a 6-digit code (expires in 15 minutes)

Both are HTML emails styled in dark/modern format.
