# B.E.I.P.I. Twitch connection setup

## 1. Register B.E.I.P.I. with Twitch

1. Sign in at https://dev.twitch.tv/console/apps
2. Make sure two-factor authentication is enabled on the Twitch account.
3. Select **Register Your Application**.
4. Use a name such as `B.E.I.P.I. Bot`.
5. Add this exact OAuth Redirect URL:

   `https://beipi-dashboard.vercel.app/api/auth/twitch/callback`

6. Choose the closest available application category and create the app.
7. Open **Manage**, copy the **Client ID**, and create a **Client Secret**.

Never paste the Client Secret into GitHub or a screenshot.

## 2. Add private values to Vercel

Open the `beipi-dashboard` project in Vercel, then go to **Settings > Environment Variables**. Add each variable to Production, Preview, and Development:

- `TWITCH_CLIENT_ID` — the Client ID from Twitch
- `TWITCH_CLIENT_SECRET` — the Client Secret from Twitch
- `TWITCH_REDIRECT_URI` — `https://beipi-dashboard.vercel.app/api/auth/twitch/callback`
- `NEXT_PUBLIC_APP_URL` — `https://beipi-dashboard.vercel.app`
- `AUTH_SECRET` — a long random secret

To generate `AUTH_SECRET` in PowerShell, run:

`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

Copy only the generated value into Vercel. Do not commit it to GitHub.

## 3. Redeploy and test

1. Redeploy the newest Vercel deployment without the old build cache.
2. Open **Connections** in B.E.I.P.I.
3. Select **Connect with Twitch**.
4. Sign in at Twitch and approve access.
5. Twitch should return you to the dashboard and show the connected channel name.

The current connection is stored in an encrypted, HTTP-only browser cookie. Permanent multi-user account storage will replace this when the B.E.I.P.I. database and account system are added.
