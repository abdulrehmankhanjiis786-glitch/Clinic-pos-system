# Clinic POS & Hospital Management System (free-plan edition)

Desktop-first web app for clinic billing. Plain JavaScript (Vite) + Firebase Authentication
and Cloud Firestore on the free **Spark** plan, hosted on Firebase Hosting.
No Cloud Functions, no Cloud Storage, no payment method.

## Status (Phase 1 of 5)

| Feature | Written | Tested | Deployed |
|---|---|---|---|
| Username login (Admin / Receptionist) | Yes | No | No |
| Hidden Developer login (Ctrl+Shift+Alt+D) | Yes | No | No |
| Roles stored in Firestore, enforced by security rules | Yes | No | No |
| Admin: create / disable staff, audit log viewer | Yes | No | No |
| Add-only audit log (rules block edits and deletes) | Yes | No | No |
| Idle sign-out (30 min staff, 15 min developer) | Yes | No | No |
| Admin password reset by email (Admin uses a real email) | Yes | No | No |
| Billing, shifts, reports | No (Phases 2-4) | - | - |

## Free-plan limits that remain

- No server: security rules are the only enforcement. Billing checks are limited to
  what rules can verify (planned for Phase 3).
- No Developer MFA (needs a paid plan). Developer accounts get minimal data access instead.
- No failed-login audit and no OTP recovery. Receptionist password problems: Admin sets
  up a new login. Admin recovers by Firebase's free reset email.
- Backups: manual download by Admin (Phase 5), not scheduled.
- Daily quota: 50,000 reads / 20,000 writes. A small clinic should fit, but heavy days could
  hit it; Firestore then refuses requests until the next day.
- The first Admin is created by hand in the Firebase console (SETUP_GUIDE.md).
