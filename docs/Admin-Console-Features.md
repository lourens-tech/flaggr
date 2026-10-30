# Admin Console Features

The club-admin and super-admin sides live in the same Expo app as the member app (`mobile/`). One codebase renders a different screen set depending on who is logged in. Everything here is verified against `api/admin/index.ts` and `mobile/src/navigation/`.

## Roles

| Role | Scope | Login | What it can do |
|---|---|---|---|
| `course_admin` | One club (`course_id`) | Email + password | Everything for its own club. **Max 2 active per club** (`MAX_COURSE_ADMINS_PER_CLUB`, `api/admin/index.ts:302`). |
| `staff` | One club | **Username** + password (staff can share one email address) | Voucher lookup/redeem, support tickets to the Flagrr team, own profile. Nothing else (`STAFF_ALLOWED_ACTIONS`). |
| `super_admin` | All clubs (no `course_id`) | Email + password | Cross-club management, ads, reports, billing status, support, audit log (`SUPER_ADMIN_ALLOWED_ACTIONS`). |
| `support_agent` | All clubs, support inbox only | Email + password | Reply to and manage support tickets only (`SUPPORT_AGENT_ALLOWED_ACTIONS`). |

Admins are a separate identity from members (`admins` / `admin_sessions` tables). Admin accounts are never self-serve: a super admin creates a club (and its first course admin), a course admin creates staff and a second admin, and a super admin creates support agents. Paid club signups from the marketing site also create the first course admin (see [Billing and Club Signup](Billing-and-Club-Signup)).

Access checks on every request (`api/_lib/auth.ts`): the account must be activated and not revoked, and a club whose subscription is `canceled` returns 403 for its course admins and staff.

### Login, forced password change, forgot password

- One login screen for every role. Staff enter their username; the others use email.
- Sign-in, forgot-password and forced-change errors (for example a failed login, a failed reset or passwords that don’t match) show as a red banner on the card rather than a pop-up.
- Accounts created by another admin get a **temporary password** (emailed) and `must_change_password = true`. The app then shows only the forced-change screen; staff also see a welcome screen afterwards. This is enforced by the app, not by the API (open issue, see [Known Limitations](Known-Limitations-and-Future-Work)).
- Forgot password sends a 6-digit code by email, valid 30 minutes (`adminForgotPassword` / `adminResetPassword`). There is no attempt limit yet.
- Super admins can reset a course admin's or support agent's password. A course admin setting a staff member's password clears that staff member's forced-change flag.
- In store builds (`EXPO_PUBLIC_STORE_BUILD=1`) the admin login entry points are hidden. Admin roles reach their login through the **web deployment** only.

## Layout

All four admin roles, plus the admin sign-in, forgot-password, forced-change and staff-welcome screens, render inside `AdminThemeScope` (`mobile/src/context/ThemeContext.tsx`), which applies the admin palette (`mobile/src/theme/admin.ts`) in light and dark. Member screens are not affected. The look ("Liquid Glass") puts translucent glass only on navigation over a blurred photo, and keeps content on opaque tiles. The photo is the club's cover image for course admins and staff, and the Flagrr photo (`strand-golf-club-fairway.jpg`) for super admins, support agents and the sign-in screens. With the OS or browser "Reduce transparency" setting on, glass becomes solid and the photo is dropped.

- **Desktop (web, 900px and wider):** `DesktopShell` draws a glass sidebar (club crest or the Flagrr mark, grouped sections from `adminNavConfig.ts`, account button, "Powered by Flagrr" for clubs), a toolbar with breadcrumb, search and bell, and the page on opaque tiles. Between 900 and 1100px the sidebar collapses to an icon rail. At 1280px and wider an Activity inspector sits on the right: for course admins, notifications filtered All, Enquiries or Receipts, with Mark all as read, refreshed every 30 seconds; for super admins, the latest audit-log entries; for support agents, their own tickets. Staff get no bell and no inspector.
- **Search (⌘K or Ctrl K, or the toolbar search pill):** `CommandPalette` jumps to any section the role can see, and for course admins and super admins also searches members (two or more characters) and opens the member's stats. Staff and support agents search sections only.
- **Phones and narrow windows:** a floating glass tab bar (`components/admin/AdminTabBar.tsx`) and a large-title header (`AdminMobileHeader`, "‹ Back" on pushed screens). Course admin tabs: Home, Enquiries, Vouchers, Rewards, More. Staff: Vouchers, Support, Profile. Super admin: Courses, Reports, Support, Ads, More. Support agent: Inbox, Profile. **More** (`AdminMoreScreen`) lists every other section in the same groups as the sidebar, with the profile at the top; for course admins it also has Activity (notifications) and carries the unread badge.
- On touch screens (coarse pointer) the desktop shell enlarges its controls. Keyboard focus shows a visible ring on the web.
- Alerts and confirms inside the admin consoles use the admin style (`AdminAlertHost`), not the member app's.
- Motion: on desktop the sidebar and toolbar stay still while the content fades in; stat cards and panels rise in, numbers roll up, charts grow and the first 20 table rows cascade in. On phones, tabs crossfade and pushed screens slide. Respects the browser or OS Reduce Motion setting.
- The web build is installable as a PWA (manifest and service worker added by `mobile/scripts/copy-static-assets.sh`).

## Course admin

Sidebar groups: Home · Members (Enquiries, Fraud Review, Member Roster) · Rewards (Rewards, Products and Activities, Vouchers) · Messaging (Push Notifications) · Club (Staff and Admins, Club Settings, Flagrr Support). Phone tabs are listed under Layout; everything else is under More.

| Area | Screens | Notes |
|---|---|---|
| Home | `AdminDashboard`, `AdminReportDetail`, `AdminMemberStats` | A hero with the club's cover photo and a greeting (Fairway ground with an outline "18" when there is no cover); **Needs you** shows pending enquiries and flagged receipts when there are any and links to them; KPIs (Flagrr Cash earned first), members joined chart, tier distribution, top rewards, member search, paged member list, report tables for redemptions, receipts and members. Home reloads every time it comes back into view. The **Course map** panel (`ScorecardUploadPanel`) is where the GM uploads up to 12 scorecard photos and sees the map's stage (send your scorecard, photos received, being built, live); see [Course Maps](Course-Maps). |
| Enquiries | `AdminEnquiriesListScreen`, `AdminEnquiryChat` | Member-to-club chat threads with status changes. |
| Rewards | `AdminRewardsList`, `AdminRewardEdit` | Rewards with variants and images. |
| Products and activities | `AdminCatalog`, `AdminCatalogItemEdit` | The receipt-matching catalogue. **Deactivate** (soft: the scanner stops matching it, history is kept, it can be switched back on from its edit screen) is the everyday action on the list and the edit screen; **Delete permanently…** is a separate, confirmed step on the list. |
| Push and broadcasts | `AdminPush`, `AdminBroadcastCompose` | Send to all members or one tier. Sending asks "Send to <audience>?" first; Send Again has its own confirm. |
| Vouchers | `AdminVoucherRedeem` | Look up a voucher by code (or scan it) and redeem it. Redeem asks "Redeem this voucher?" naming the reward and member. |
| Fraud review | `AdminFraudOversight` | Flagged receipts, receipt image, confirm fraud (a reason is required and sent to the member) or approve. On desktop a split view: list on the left, the selected receipt and its photo on the right. |
| Member list | `AdminMemberList` | Upload the club's member roster (CSV or XLSX, max 5,000 rows, columns member number / first name / last name / email) and see its status. |
| Staff and club admins | `AdminStaffList`, `AdminStaffEdit`, `AdminStaffActivity`, `AdminClubAdmins` | Create, edit, revoke, reactivate, delete staff; redemption activity per staff member; invite and revoke the club's other admin. A Staff / Club Admins / Activity switch at the top moves between the three. |
| Club Settings | `AdminCourseProfile` | Cover photo with "Change cover photo…", the club logo with "Change logo…", and the club name as the page title. Details (name, contact email, phone, address) are edited inline and saved with **Save changes** (in the toolbar on desktop). Flagrr Cash per Rand is read-only (see below). A subscription card shows the status and a past-due warning. Your account: name and email, **Change password…** (opens a sheet), Terms and Privacy, Log out. |
| Support | `AdminSupportTickets`, `AdminSupportTicketCreate`, `AdminSupportTicketChat` | Tickets from the club to the Flagrr team ("Flagrr Support" in the sidebar, More and staff tabs). |
| Activity | `AdminNotifications` | In-app admin notifications (titled Activity), with search, filters and **Mark all as read**. The same feed is in the desktop Activity inspector. |
| Onboarding | `AdminOnboardingWizard`, `AdminStaffOnboardingWizard` | First login: profile, logo and cover, then a staff setup step. |

Notes:
- **Roster and tiers:** a member who is not on the club's uploaded roster stays capped at Bronze until the club verifies them. Matching is on first name, last name and email, case-insensitive (`matchesRoster`).
- **Flagrr Cash per Rand** (`fb_per_rand`) cannot be changed from any screen; it needs a database edit.
- **Ads:** course admins have no ads screens (the unreachable `AdminAdsListScreen` and `AdminAdEditScreen` were deleted on 2026-10-29). The API still accepts ad actions from a course admin, which is an open security issue.
- **Excel export** buttons only work in the web app. On native they show a "Web only for now" alert.

## Staff

Vouchers, Flagrr Support and Profile only (`ADMIN_STAFF_NAV_GROUPS`, phone tabs Vouchers, Support, Profile). After the forced password change, a welcome screen is shown.

## Super admin

Sidebar groups: Clubs (Courses, Course Maps) · Insights (Reports) · Engagement (Ads, Push Notifications) · Trust and support (Fraud Review, Support Inbox) · Admin (Support Agents, Audit Log). Profile is on the account button (desktop) or at the top of More (phone).

| Area | Screens | Notes |
|---|---|---|
| Course maps | `SuperAdminCourseMaps`, `SuperAdminCourseMap` | Every club's map stage; view and download a club's scorecard photos; import a course map file, see what blocks publishing, publish, unpublish, replace, delete a draft. Away-only courses (not Flagrr clubs) are imported here too. Reached from the sidebar or the map icon on Courses. See [Course Maps](Course-Maps). |
| Courses | `SuperAdminCourses`, `SuperAdminCourseCreate` | A photo header with counts (clubs, members, awaiting setup, past due), then a sortable table on desktop (cards on phones) with filters and search; each club links to its Ads, Rewards, Catalog and Members, and a ⋯ menu holds archive / unarchive and cancel / reactivate subscription (see [Billing](Billing-and-Club-Signup)). Reactivate and unarchive now ask for confirmation, like cancel and archive. Create a club with the four-step wizard (also creates its `merchants` row and first course admin). **Setup Pending** means the club's admin has not finished the first-login setup wizard (logging in alone does not clear it); the hint under it says "Awaiting its first admin invite" when the club has no admin, and "Admin invited. Waiting for them to finish setup." when it has one. The stand-in club "My Club Isn't Listed Yet" shows as **Placeholder club** and is never counted as pending. |
| Per club | `SuperAdminCourseAds`, `SuperAdminCourseRewards`, `SuperAdminCourseCatalog`, `SuperAdminCourseMemberList`, `SuperAdminCourseEnquiries` (read-only chat), `SuperAdminCourseAdmins`, `SuperAdminCourseAdminCreate` | Breadcrumb `Courses › {club} › {section}`. Includes roster upload and course admin password reset, revoke, reactivate, delete. The catalogue uses the same Deactivate / Delete permanently… split as the club's own screen. |
| Ads | `SuperAdminAds`, `SuperAdminAdEdit`, `SuperAdminAdDetail` | Global ads or ads targeted at specific clubs; performance by slot, by club and over time; click log. |
| Reports | `SuperAdminReports`, `SuperAdminReportDetail`, `SuperAdminStatBreakdown`, `SuperAdminClubMembers`, `SuperAdminMemberStats` | Dashboard (six KPI tiles, members joined this year, tier distribution, top redeemed rewards with photo and club, member search, ad performance with Combined / By Slot / By Club / By Ad and Excel export; no Activity panel on this page), cross-club reports, per-member stats, many `.xlsx` exports, gift or adjust Flagrr Cash for a member. |
| Fraud | `SuperAdminFraudOversight` | Flagged receipts across clubs plus duplicate receipt attempts. |
| Push and broadcasts | `SuperAdminPush`, `SuperAdminBroadcastCompose` | Includes a `course_admins` target. Sending asks "Send to <audience> — <club scope>?" first. |
| Support | `SuperAdminSupport`, `SuperAdminSupportTicketChat` | Cross-club inbox filtered by status, priority and assignee: claim, release, take over, set priority and status (menus above the thread), reply. |
| Agents | `SuperAdminAgents`, `SuperAdminAgentCreate` | Create, reset password, revoke, reactivate, delete support agents. |
| Audit log | `SuperAdminAuditLog` | Records super admin mutations and fraud decisions, plus course map imports, publishing and scorecard photo uploads. Catalogue saves, deactivations, permanent deletes and fraud decisions now show readable labels instead of raw action codes. |

## Support agent

Inbox and Profile only (sidebar and phone tabs). Cannot see clubs, ads, rewards, reports or agent management.

## Audit log

Super admin mutations and fraud confirm/approve decisions are logged (`api/_lib/auditLog.ts`). Course-admin actions other than fraud decisions (rewards, catalogue, staff, co-admin changes, roster uploads, broadcasts, profile edits) are **not** logged yet.

## Known gaps in the admin side

- Course admins can still call the ad endpoints, and can edit or delete multi-club ads created by a super admin.
- No rate limit on admin login or password reset codes.
- A voucher can be redeemed twice if two staff scan at the same moment.
- Archiving a club only hides it in the super-admin list; its members, admins and staff are unaffected.
- Super admins can create course admins past the 2-per-club cap; course admins cannot.
- Super admin, support agent and staff have no change-password option in their profile.

The full, current list is in [Known Limitations and Future Work](Known-Limitations-and-Future-Work).

## Creating a super admin

There is no screen or API action that creates a `super_admin`. A super admin is added by inserting a row into `admins` directly in the database (role `super_admin`, no `course_id`, a bcrypt `password_hash`, `must_change_password = true`, `activated_at = now()`). The new super admin logs in with their email and the temporary password and is forced to change it. Support agents and course admins, by contrast, are created from the super-admin console.
