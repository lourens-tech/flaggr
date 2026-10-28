# Flagrr Wiki

Flagrr is a golf loyalty app. Members earn **Flagrr Cash** (FC) by scanning receipts and playing rounds at their home golf club, and redeem it for rewards (rounds, coaching, pro-shop/kitchen/bar vouchers, and more). Golf clubs run their side from an admin console in the same app, and the Flagrr team runs the platform from a super-admin console.

**Live app:** https://flagrr-loyalty.vercel.app

## Pages

- **[Member App Features](Member-App-Features)** — a full walkthrough of everything a member can do in the app: onboarding, the Home dashboard, earning Flagrr Cash, tiers, streaks, referrals, the Rewards Shop, profile, notifications, and support.
- **[Admin Console Features](Admin-Console-Features)** — what club admins, club staff, support agents, and super admins can do, and which role can reach what.
- **[Course Maps](Course-Maps)** — how a club's hole maps and scorecard are built from the GM's scorecard photos and OpenStreetMap, checked and published.
- **[Billing and Club Signup](Billing-and-Club-Signup)** — how a golf club signs up and pays through PayFast, how its admin account is created, and the grace-period rules for missed payments.
- **[Technical Architecture](Technical-Architecture)** — the stack, how the API and database are organized, deployment, and the platform constraints that shaped some design decisions.
- **[Environment and Setup](Environment-and-Setup)** — the environment variables, external accounts, and commands needed to run and deploy the app.
- **[Brand Kit](Brand-Kit)** — colours, type, logo rules, voice, and the claims Flagrr may and may not make in marketing material.
- **[Known Limitations & Future Work](Known-Limitations-and-Future-Work)** — what is not built or not finished yet, with the groundwork that already exists.
- **[UAT Checklist](UAT-Checklist)** — a practical, click-through checklist for manually testing the member-facing app before considering it ready.

## At a glance

| | |
|---|---|
| **Platform** | React Native (Expo SDK 57). Deployed as a web export on Vercel. The native build configuration exists (EAS project, iOS bundle id and Android package `com.flagrr.loyalty`), but store distribution and push notifications are not confirmed live — see [Known Limitations](Known-Limitations-and-Future-Work). |
| **Backend** | Vercel serverless functions (Node/TypeScript), 12 functions — the Vercel Hobby plan cap |
| **Database** | Neon (serverless Postgres), multi-tenant by golf club ("course"). 48 migrations in `db/migrations/` |
| **Currency** | Flagrr Cash (FC) — formerly "Flagrr Bucks" |
| **Tiers** | Bronze / Silver / Gold / Platinum, re-qualified every calendar quarter |
| **Roles** | Member, club admin, club staff, support agent, super admin |
| **Billing** | PayFast subscription for golf clubs (first payment, then a recurring monthly amount) |
| **Email** | Resend |
| **Receipt reading** | Tesseract OCR by default; optional Claude vision extraction via `RECEIPT_EXTRACTOR=claude` |
| **Related repo** | `ewo-solutions/flagrr-marketing` — the Next.js marketing website, including the club signup page that starts the PayFast checkout |
