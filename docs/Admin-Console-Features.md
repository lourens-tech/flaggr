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
- Accounts created by another admin get a **temporary password** (emailed) and `must_change_password = true`. The app then shows only the forced-change screen; staff also see a welcome screen afterwards. This is enforced by the app, not by the API (open issue, see [Known Limitations](Known-Limitations-and-Future-Work)).
- Forgot password sends a 6-digit code by email, valid 30 minutes (`adminForgotPassword` / `adminResetPassword`). There is no attempt limit yet.
- Super admins can reset a course admin's or support agent's password. A course admin setting a staff member's password clears that staff member's forced-change flag.
- In store builds (`EXPO_PUBLIC_STORE_BUILD=1`) the admin login entry points are hidden. Admin roles reach their login through the **web deployment** only.

## Layout

- On the web at widths of 900px or more, a desktop shell with a left sidebar is used (`useIsDesktopNav`, `DesktopShell`, `AdminDesktopFrame`, `SuperAdminDesktopFrame`, nav groups in `adminNavConfig.ts`), with an activity rail that refreshes every 30 seconds.
- On native and narrow browser windows, a bottom tab bar is used.
- The web build is installable as a PWA (manifest and service worker added by `mobile/scripts/copy-static-assets.sh`).

## Course admin

Bottom tabs / sidebar: Dashboard, Enquiries, Rewards, Push, Vouchers, Course Profile. Other screens are reached from those.

| Area | Screens | Notes |
|---|---|---|
| Dashboard | `AdminDashboard`, `AdminReportDetail`, `AdminMemberStats` | KPIs, member search, paged member list, report tables for redemptions, receipts and members. |
| Enquiries | `AdminEnquiriesListScreen`, `AdminEnquiryChat` | Member-to-club chat threads with status changes. |
| Rewards | `AdminRewardsList`, `AdminRewardEdit` | Rewards with variants and images. |
| Products and activities | `AdminCatalog`, `AdminCatalogItemEdit` | The receipt-matching catalogue. Soft or permanent delete. |
| Push and broadcasts | `AdminPush`, `AdminBroadcastCompose` | Send to all members or one tier. |
| Vouchers | `AdminVoucherRedeem` | Look up a voucher by code and redeem it. |
| Fraud review | `AdminFraudOversight` | Flagged receipts, receipt image, confirm fraud or approve. |
| Member list | `AdminMemberList` | Upload the club's member roster (CSV or XLSX, max 5,000 rows, columns member number / first name / last name / email) and see its status. |
| Staff and club admins | `AdminStaffList`, `AdminStaffEdit`, `AdminStaffActivity`, `AdminClubAdmins` | Create, edit, revoke, reactivate, delete staff; redemption activity per staff member; invite and revoke the club's other admin. |
| Course profile | `AdminCourseProfile` | Name, contact details, logo, cover image. Flagrr Cash per Rand is read-only (see below). Shows subscription status and a past-due warning. Change password. |
| Support | `AdminSupportTickets`, `AdminSupportTicketCreate`, `AdminSupportTicketChat` | Tickets from the club to the Flagrr team. |
| Notifications | `AdminNotifications` | In-app admin notifications. |
| Onboarding | `AdminOnboardingWizard`, `AdminStaffOnboardingWizard` | First login: profile, logo and cover, then a staff setup step. |

Notes:
- **Roster and tiers:** a member who is not on the club's uploaded roster stays capped at Bronze until the club verifies them. Matching is on first name, last name and email, case-insensitive (`matchesRoster`).
- **Flagrr Cash per Rand** (`fb_per_rand`) cannot be changed from any screen; it needs a database edit.
- **Ads:** the Ads tab was removed from the course admin UI on purpose. `AdminAdsListScreen` and `AdminAdEditScreen` still exist but are not reachable from the course-admin navigation (`AdminAdEdit` is still registered). The API still accepts ad actions from a course admin, which is an open security issue.
- **Excel export** buttons only work in the web app. On native they show a "Web only for now" alert.

## Staff

Vouchers tab and profile only (`ADMIN_STAFF_NAV_GROUPS`), plus support tickets. After the forced password change, a welcome screen is shown.

## Super admin

Bottom tabs / sidebar: Courses, Ads, Reports, Push, Support, Profile.

| Area | Screens | Notes |
|---|---|---|
| Courses | `SuperAdminCourses`, `SuperAdminCourseCreate` | List with filters; create a club (also creates its `merchants` row and first course admin); archive and unarchive; cancel and reactivate subscription (see [Billing](Billing-and-Club-Signup)). |
| Per club | `SuperAdminCourseAds`, `SuperAdminCourseRewards`, `SuperAdminCourseCatalog`, `SuperAdminCourseMemberList`, `SuperAdminCourseEnquiries` (read-only chat), `SuperAdminCourseAdmins`, `SuperAdminCourseAdminCreate` | Includes roster upload and course admin password reset, revoke, reactivate, delete. |
| Ads | `SuperAdminAds`, `SuperAdminAdEdit`, `SuperAdminAdDetail` | Global ads or ads targeted at specific clubs; performance by slot, by club and over time; click log. |
| Reports | `SuperAdminReports`, `SuperAdminReportDetail`, `SuperAdminStatBreakdown`, `SuperAdminClubMembers`, `SuperAdminMemberStats` | Dashboard, cross-club reports, member search, per-member stats, many `.xlsx` exports, gift or adjust Flagrr Cash for a member. |
| Fraud | `SuperAdminFraudOversight` | Flagged receipts across clubs plus duplicate receipt attempts. |
| Push and broadcasts | `SuperAdminPush`, `SuperAdminBroadcastCompose` | Includes a `course_admins` target. |
| Support | `SuperAdminSupport`, `SuperAdminSupportTicketChat` | Cross-club inbox: claim, assign, set priority and status, reply. |
| Agents | `SuperAdminAgents`, `SuperAdminAgentCreate` | Create, reset password, revoke, reactivate, delete support agents. |
| Audit log | `SuperAdminAuditLog` | Records super admin mutations and fraud decisions. |

## Support agent

Support inbox and profile only. Cannot see clubs, ads, rewards, reports or agent management.

## Audit log

Super admin mutations and fraud confirm/approve decisions are logged (`api/_lib/auditLog.ts`). Course-admin actions other than fraud decisions (rewards, catalogue, staff, co-admin changes, roster uploads, broadcasts, profile edits) are **not** logged yet.

## Known gaps in the admin side

- Course admins can still call the ad endpoints, and can edit or delete multi-club ads created by a super admin.
- No rate limit on admin login or password reset codes.
- A voucher can be redeemed twice if two staff scan at the same moment.
- Archiving a club only hides it in the super-admin list; its members, admins and staff are unaffected.
- The desktop "Search" box in `DesktopShell` is not wired up.
- Super admins can create course admins past the 2-per-club cap; course admins cannot.
- Super admin, support agent and staff have no change-password option in their profile.

The full, current list is in [Known Limitations and Future Work](Known-Limitations-and-Future-Work).
