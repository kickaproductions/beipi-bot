let appToken: { value: string; expiresAt: number } | undefined;

async function getAppToken(clientId: string, clientSecret: string) {
    if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;

    const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error('Twitch authentication failed');

    const token = await response.json() as { access_token: string; expires_in: number };
    appToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    return appToken.value;
}

export async function twitchAppFetch(url: URL) {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Twitch app credentials are missing');

    const lookup = (token: string) => fetch(url, {
        headers: { 'Client-Id': clientId, Authorization: 'Bearer ' + token },
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
    });
    const token = await getAppToken(clientId, clientSecret);
    const response = await lookup(token);
    if (response.status !== 401) return response;

    if (appToken?.value === token) appToken = undefined;
    return lookup(await getAppToken(clientId, clientSecret));
}
