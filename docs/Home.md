# Flagrr Wiki

Flagrr is a golf loyalty app. Members earn **Flagrr Cash** (FC) by scanning receipts and playing rounds at their home golf club, and redeem it for rewards (rounds, coaching, pro-shop/kitchen/bar vouchers, and more). The member-facing app is live today; the golf-course-admin and super-admin sides are planned but not yet built.

**Live app:** https://flagrr-loyalty.vercel.app

## Pages

- **[Member App Features](Member-App-Features)** — a full walkthrough of everything a member can do in the app today: onboarding, the Home dashboard, earning Flagrr Cash, tiers, streaks, the Rewards Shop, profile, notifications, and support.
- **[Technical Architecture](Technical-Architecture)** — the stack, how the API and database are organized, deployment, and the platform constraints that shaped some design decisions.
- **[Known Limitations & Future Work](Known-Limitations-and-Future-Work)** — what's deliberately not built yet, and what groundwork already exists to support it.
- **[UAT Checklist](UAT-Checklist)** — a practical, click-through checklist for manually testing every feature before considering the member-facing app ready.

## At a glance

| | |
|---|---|
| **Platform** | React Native (Expo SDK 57), deployed today as a web app; native iOS/Android builds not yet produced |
| **Backend** | Vercel serverless functions (Node/TypeScript) |
| **Database** | Neon (serverless Postgres), multi-tenant by golf club ("course") |
| **Currency** | Flagrr Cash (FC) — formerly "Flagrr Bucks" |
| **Tiers** | Bronze / Silver / Gold / Platinum, re-qualified every calendar quarter |
| **Admin side** | Not built yet — see [Known Limitations](Known-Limitations-and-Future-Work) |
