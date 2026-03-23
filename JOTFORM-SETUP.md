# Jotform Supplier Directory — Setup Guide

This document covers everything needed to get the automated supplier
directory running from scratch. Once set up, every new Jotform submission
appears on the website automatically.

---

## How it works

1. A supplier fills in the Jotform form.
2. Jotform fires a webhook to `/api/jotform-webhook` on the site.
3. The webhook validates the submission and commits the updated
   `public/data/suppliers.json` to GitHub via the API.
4. Netlify detects the new commit and redeploys — the supplier is live
   within roughly 60 seconds.
5. As a safety net, a GitHub Actions workflow runs every day at 3am UTC
   and rebuilds the full list from Jotform from scratch.

---

## INITIAL SETUP

### Step 1 — Jotform API key

1. Go to **jotform.com/myaccount/api**
2. Generate or copy your API key
3. Add it to your environment (Netlify dashboard → Site settings →
   Environment variables):

```
JOTFORM_API_KEY=your_key_here
```

Also add it as a GitHub Actions secret (repo Settings → Secrets and
variables → Actions → New repository secret):

```
Secret name:  JOTFORM_API_KEY
Secret value: your_key_here
```

---

### Step 2 — Webhook secret

Choose a strong random string. You can generate one with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add it to your Netlify environment variables:

```
JOTFORM_WEBHOOK_SECRET=your_secret_here
```

---

### Step 3 — GitHub token (for real-time updates)

The webhook commits directly to your repository so Netlify deploys
immediately. For this to work, create a fine-grained personal access
token:

1. Go to **github.com/settings/tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Set expiry as desired (1 year is reasonable)
4. Under **Repository access**: select this repository only
5. Under **Permissions → Repository permissions**:
   - **Contents** → Read and write
6. Click **Generate token** and copy it immediately

Add these to Netlify environment variables:

```
GITHUB_TOKEN=your_pat_here
GITHUB_OWNER=your-github-username
GITHUB_REPO=tmwproductions
GITHUB_BRANCH=main
```

---

### Step 4 — Run the initial sync

Populate the directory with any existing submissions:

```bash
JOTFORM_API_KEY=your_key npm run sync-suppliers
```

This writes `public/data/suppliers.json` and `public/data/sync-meta.json`.
Commit and push these files — Netlify will deploy them.

```bash
git add public/data/
git commit -m "chore: initial supplier sync"
git push
```

---

### Step 5 — Deploy the site

Make sure the site is deployed to Netlify so the webhook endpoint is
publicly accessible. The URL will be:

```
https://yourdomain.com/api/jotform-webhook
```

---

## CONFIGURING THE JOTFORM WEBHOOK

1. Go to your form at **jotform.com**
2. **Settings → Integrations → WebHooks**
3. Click **Add Webhook**
4. Enter your webhook URL with the secret appended as a query parameter:

```
https://yourdomain.com/api/jotform-webhook?secret=YOUR_WEBHOOK_SECRET
```

Replace `yourdomain.com` with your actual Netlify domain (e.g.
`tmwproductions.netlify.app` or your custom domain), and
`YOUR_WEBHOOK_SECRET` with the value you set in Step 2.

5. Click **Complete Integration**

From this point, every new submission will appear on the website
within about 60 seconds. The daily sync at 3am acts as a backup.

---

## VERIFYING IT WORKS

After setup, submit a test entry through the Jotform form and:

1. Check the Netlify function logs (Functions tab in Netlify dashboard)
   for a `webhook_success` log entry.
2. Wait ~60 seconds for Netlify to deploy, then check
   `/people-i-recommend.html` — the new supplier should appear.

If the supplier doesn't appear immediately, the daily sync will pick it
up within 24 hours. You can also trigger a manual sync from GitHub
(Actions tab → **Sync Suppliers from Jotform** → **Run workflow**).

---

## PRIVATE FIELDS

The following form fields are **never** written to any public file or log:

- **q8** — Contact name
- **q9** — Contact email

Only q2 (name), q3 (category), q4 (subcategory), q5 (description),
q6 (website), q7 (area), and q10 (logo URL) are included in
`suppliers.json`.

---

## FORM FIELDS REFERENCE

| Jotform field | Purpose          | Public |
|---------------|------------------|--------|
| q2            | Supplier Name    | ✓      |
| q3            | Category         | ✓      |
| q4            | Subcategory      | ✓      |
| q5            | Description      | ✓      |
| q6            | Website URL      | ✓      |
| q7            | Area Served      | ✓      |
| q8            | Contact Name     | ✗ (private) |
| q9            | Contact Email    | ✗ (private) |
| q10           | Logo URL         | ✓      |
