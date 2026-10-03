# Setup Guide (Chromebook, no installs, no payment)

**[YOU]** = needs your own account. Never share passwords or keys with anyone, including the AI.
If any screen asks you to "Upgrade", "Blaze", or add a card: close it. You do not need it.

## Step 1. GitHub  [YOU]
1. github.com > **New repository**, name `clinic-pos`, choose **Private**.
2. Unzip the project (Files app > right-click > Extract all).
3. On the repository page click **uploading an existing file**, drag in ALL files and folders
   (also hidden ones like `.gitignore`; in Files press Ctrl+. to show hidden files). Commit.
4. Check that no file named `.env` is in the repository.

## Step 2. Browser editor  [YOU]
Repository page > **Code > Codespaces > Create codespace**. Keep the spending limit at $0
(GitHub > Settings > Billing). Open **Terminal > New Terminal**.

## Step 3. Install parts
```
npm install
cp .env.example .env
```

## Step 4. Firebase console (stay on the free Spark plan)  [YOU]
1. Project settings (gear) > General > **Your apps** > web icon `</>`. Name it, skip Hosting
   setup, copy the config values into `.env` (open it in the Codespace).
2. **Build > Authentication > Get started > Email/Password > Enable** (first switch only).
3. **Build > Firestore Database > Create database > production mode**, pick a nearby location
   (cannot be changed later).

## Step 5. Publish the security rules
```
npx firebase-tools login --no-localhost
npx firebase-tools use --add
npx firebase-tools deploy --only firestore
```
(`use --add`: choose your project, alias `default`.)

## Step 6. Create the first Admin by hand  [YOU]
1. Console > **Authentication > Users > Add user**. Email: `yourname@clinicpos.local`
   (or your real email address if you want email password reset). Set a strong password.
   Copy the **User UID** shown in the list.
2. Console > **Firestore Database > Start collection**: name `users`. Document ID: paste the UID.
   Add these fields (all type string except disabled):
   - `username` = yourname (or your email)
   - `displayName` = your full name
   - `role` = admin
   - `recoveryEmail` = your email
   - `disabled` = false (type **boolean**)

## Step 7. Run it
```
npm run dev
```
Open the popup link. Add the page's hostname (like `xxxx-5173.app.github.dev`) under
**Authentication > Settings > Authorized domains**. Sign in with your username.

## Step 8. Publish the website (free Firebase Hosting)
```
npm run build
npx firebase-tools deploy --only hosting
```
Your site appears at `https://YOUR-PROJECT-ID.web.app`. To update later, run both lines again.

## Step 9. First checks (tell me the results)
1. Admin: create a receptionist and a developer (Receptionists & Staff).
2. Sign in as receptionist: only the receptionist screen. Developer on the normal form: fails.
3. Signed out, click an empty area, press Ctrl+Shift+Alt+D: developer sign-in. Esc goes back.
4. Admin > Audit Logs shows the events. Disable the receptionist: they can no longer enter.
