# TMW Productions — WhatsApp Enquiry Auto-Reply

When a visitor submits the contact form and ticks the opt-in checkbox, they
automatically receive a one-time WhatsApp confirmation message via Twilio.

---

## How It Works

1. Visitor fills in the enquiry form on `contact.html`
2. If they tick **"Send me a WhatsApp message to confirm you've received my
   enquiry"**, the form fires a `navigator.sendBeacon` POST to
   `/api/enquiry-webhook` as the form navigates to the booking system
3. The Netlify Function validates the request, normalises the phone number to
   E.164, and sends the message via Twilio's WhatsApp API
4. A consent record (name + send status — **no mobile number**) is appended to
   `consent-log.json` as a lightweight ICO-compliant audit trail

---

## 1 — Set Up a Twilio Account & WhatsApp Sandbox

1. Create a free account at [twilio.com](https://www.twilio.com)
2. In the Twilio Console, go to **Messaging → Try it out → Send a WhatsApp
   message** and follow the sandbox activation steps
3. The sandbox number is `+1 415 523 8886`. Your test device must send the
   join code (e.g. `join <word>-<word>`) to that number on WhatsApp first
4. Note your **Account SID** and **Auth Token** from the Console home screen

---

## 2 — Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | Your Twilio WhatsApp number, prefixed `whatsapp:` |
| `BUSINESS_NAME` | Sign-off name in the message (e.g. `Tom @ TMW Productions`) |
| `WEBHOOK_SECRET` | Random string used to verify requests (optional locally) |
| `CONSENT_LOG_PATH` | Path for the consent log file (defaults to `/tmp/consent-log.json`) |

**Never commit `.env` to git.** It is already listed in `.gitignore`.

In Netlify, set variables at:
**Site settings → Environment variables → Add a variable**

---

## 3 — Deploy to Netlify

### Option A — Connect GitHub (recommended)

1. Push this repository to GitHub
2. In the Netlify dashboard: **Add new site → Import an existing project**
3. Select your repository — Netlify will detect `netlify.toml` automatically
4. Add your environment variables (see above)
5. Deploy

### Option B — Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

The function is available at `/.netlify/functions/enquiry-webhook` and
redirected to `/api/enquiry-webhook` by `netlify.toml`.

### Local development

```bash
npm install
netlify dev          # starts the function at http://localhost:8888
```

Test with curl:

```bash
curl -X POST http://localhost:8888/api/enquiry-webhook \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","mobile":"07700900123","whatsapp_consent":true,"message":"Hello"}'
```

---

## 4 — Submit a Message Template to Meta (Production)

The Twilio Sandbox does not require pre-approved templates. However, for
production use (sending to numbers that haven't joined your sandbox),
WhatsApp requires templates approved by Meta.

**Steps:**

1. Upgrade your Twilio WhatsApp account from sandbox to a full WhatsApp
   Business sender: Twilio Console → **Messaging → Senders → WhatsApp Senders**
2. Click **Request Access** and complete Meta's Business Verification process
3. Once approved, go to **Messaging → Content Template Builder**
4. Create a new template with a name such as `enquiry_confirmation` and the
   following body:

   ```
   Hi {{1}}, thanks for getting in touch — I've received your enquiry
   and will get back to you as soon as possible.
   — {{2}}
   ```

   Where `{{1}}` = first name and `{{2}}` = business name.

5. Submit for Meta review (typically 24–48 hours)
6. Once approved, update `enquiry-webhook.js` to use the
   `client.messages.create({ contentSid: '...', contentVariables: '...' })`
   template API instead of the freeform `body` field

---

## 5 — UK GDPR & PECR Compliance

### What the opt-in checkbox covers

The checkbox wording is:

> *"Send me a WhatsApp message to confirm you've received my enquiry.
> I understand this is a one-time confirmation, not a marketing list. (Optional)"*

This satisfies:

- **UK GDPR Article 6(1)(a)** — the lawful basis is explicit, freely given,
  specific, informed, and unambiguous consent
- **PECR Regulation 6** — electronic marketing (which includes unsolicited
  WhatsApp messages) requires prior consent; this checkbox obtains it
- **ICO guidance on granular consent** — the checkbox is unchecked by default,
  separate from any other consents, and cannot be bundled with form submission
- **Purpose limitation** — the consent is scoped *only* to the one-time
  confirmation message; it cannot be used to send future marketing

### What it does NOT cover

- **Ongoing marketing messages** — a separate opt-in (with separate wording
  and record-keeping) is required for any future WhatsApp, SMS or email
  marketing campaigns
- **Third-party sharing** — the phone number is processed solely to send the
  confirmation; it must not be passed to any third party without a new consent
- **Retention** — you should define and document how long you hold phone
  numbers and consent records, and delete them in line with your privacy policy

### Consent audit trail

`consent-log.json` records:

```json
{
  "timestamp": "2026-03-22T10:00:00.000Z",
  "name": "Jane Smith",
  "consent_given": true,
  "send_status": "sent"
}
```

Mobile numbers are **never** written to this file, in line with the ICO's
data minimisation principle. This log should be backed up and retained for
as long as you hold the associated enquiry data.

> **Note on serverless environments:** In a Netlify Function, the filesystem
> is ephemeral — `/tmp` is reset between cold-starts. For a production-grade
> audit trail, replace the file write in `enquiry-webhook.js` with an API
> call to Airtable, a Google Sheet, or a managed database (e.g. PlanetScale,
> Supabase). The log schema above remains the same.

---

## File Structure

```
tmwproductions/
├── contact.html                    # Updated form with opt-in checkbox
├── netlify/
│   └── functions/
│       └── enquiry-webhook.js      # Netlify Function (webhook + Twilio)
├── netlify.toml                    # Netlify build + redirect config
├── package.json                    # Dependencies (twilio)
├── .env.example                    # Environment variable template
├── consent-log.json                # Consent audit trail (starts empty)
└── README.md                       # This file
```
