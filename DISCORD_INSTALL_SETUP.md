# Add B.E.I.P.I. to Discord

The dashboard's **Add to Discord** button uses the bot's public Discord Application ID.

1. Open the Discord Developer Portal and select the B.E.I.P.I. application.
2. On **General Information**, copy **Application ID**.
3. In Vercel, open the B.E.I.P.I. project and go to **Settings → Environment Variables**.
4. Add `DISCORD_CLIENT_ID` with the copied Application ID as its value.
5. Apply it to Production, Preview, and Development, then redeploy.

The Application ID is public and may be stored in Vercel. Never place the Discord bot token or client secret in screenshots, GitHub, or this file.

The generated invite intentionally avoids Administrator permission. It requests the permissions B.E.I.P.I. needs for planned roles, channels, event scheduling, messages, reaction roles, banners, and live alerts.
