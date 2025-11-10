# Lead Ingestion Setup Guide

This guide explains how to set up lead ingestion from multiple channels: Email, WhatsApp, and LinkedIn.

## Overview

Your CRM now supports automatic lead creation from three channels:
- **Email**: Receive emails and automatically create leads
- **WhatsApp**: Capture leads from WhatsApp Business messages
- **LinkedIn**: Import LinkedIn profiles as leads

## 1. Email Lead Ingestion

### Webhook URL
```
https://nbfwygkifdklvigbtxwq.supabase.co/functions/v1/ingest-email-leads
```

### Setup with Resend (Recommended)
1. Go to [Resend Dashboard](https://resend.com/domains)
2. Navigate to **Domains** → Select your domain → **Inbound**
3. Add a forwarding rule:
   - Forward emails to: `YOUR_WEBHOOK_URL`
   - Example: Forward `leads@yourdomain.com` to the webhook

### What happens:
- When someone emails your designated address, a new lead is automatically created
- If the lead already exists (matched by email), their notes are updated
- Company name is extracted from email domain

### Payload format (for custom integrations):
```json
{
  "from": "John Doe <john@company.com>",
  "subject": "Interested in your product",
  "text": "I'd like to learn more...",
  "html": "<p>I'd like to learn more...</p>"
}
```

## 2. WhatsApp Lead Ingestion

### Prerequisites
You've already configured:
- ✅ WHATSAPP_ACCESS_TOKEN
- ✅ WHATSAPP_PHONE_NUMBER_ID
- ✅ WHATSAPP_VERIFY_TOKEN

### Webhook URL
```
https://nbfwygkifdklvigbtxwq.supabase.co/functions/v1/ingest-whatsapp-leads
```

### Setup with Meta WhatsApp Business
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app → **WhatsApp** → **Configuration**
3. Add webhook:
   - Callback URL: `YOUR_WEBHOOK_URL`
   - Verify Token: Use the token you configured in secrets
   - Subscribe to: `messages`

### What happens:
- When someone messages your WhatsApp Business number, a lead is created
- If the lead exists (matched by phone), their notes are updated
- Automatic reply is sent thanking them for reaching out

### Test your setup:
1. Send a message to your WhatsApp Business number
2. Check your CRM for a new lead with source "whatsapp"

## 3. LinkedIn Lead Import

### Webhook URL
```
https://nbfwygkifdklvigbtxwq.supabase.co/functions/v1/ingest-linkedin-leads
```

### Setup Options

#### Option A: Manual Import (Recommended for small batches)
Use a tool like [Phantom Buster](https://phantombuster.com/) or [LinkedIn Helper](https://www.linkedhelper.com/) to export profiles, then send them to the webhook.

#### Option B: CSV Import
1. Export LinkedIn profiles to CSV
2. Transform to JSON format (see below)
3. POST to the webhook URL

### Payload format:
```json
[
  {
    "name": "Jane Smith",
    "linkedin_url": "https://linkedin.com/in/janesmith",
    "company": "Tech Corp",
    "title": "VP of Sales",
    "email": "jane@techcorp.com",
    "phone": "+1234567890",
    "location": "San Francisco, CA",
    "industry": "Technology",
    "summary": "Experienced sales leader..."
  }
]
```

### What happens:
- Profiles are imported as leads with source "linkedin"
- Existing leads (matched by LinkedIn URL) are updated
- Each profile gets a lead score of 40 (higher than email/WhatsApp)

### Example cURL command:
```bash
curl -X POST https://nbfwygkifdklvigbtxwq.supabase.co/functions/v1/ingest-linkedin-leads \
  -H "Content-Type: application/json" \
  -d '[{
    "name": "John Doe",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "company": "ABC Inc",
    "email": "john@abc.com"
  }]'
```

## Lead Scoring

Each channel automatically assigns an initial lead score:
- **Email**: 30 points (lowest barrier to entry)
- **WhatsApp**: 35 points (higher engagement)
- **LinkedIn**: 40 points (professional context, pre-qualified)

## Monitoring

All lead ingestion activities are logged. Check your edge function logs:
1. Go to your backend
2. Navigate to Edge Functions
3. Select the relevant function (ingest-email-leads, ingest-whatsapp-leads, ingest-linkedin-leads)
4. View logs for webhook activity and errors

## Troubleshooting

### Email leads not appearing
- Verify your email forwarding rule is active
- Check that emails are being forwarded to the correct webhook URL
- Review edge function logs for errors

### WhatsApp webhook not working
- Verify webhook URL is correctly configured in Meta dashboard
- Check that verify token matches
- Ensure WhatsApp app is in production mode (not development)

### LinkedIn import fails
- Verify JSON payload format matches the schema
- Check that linkedin_url field is included for each profile
- Review response for specific error messages

## Security Notes

- All webhooks are public endpoints (no JWT required)
- Email webhook validates sender information
- WhatsApp webhook verifies requests using Meta's verification token
- LinkedIn endpoint accepts any valid JSON payload

## Support

For issues or questions, check the edge function logs for detailed error messages.
