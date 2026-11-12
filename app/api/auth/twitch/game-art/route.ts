import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    });
    if (!response.ok) throw new Error('Twitch authentication failed');

    const token = await response.json() as { access_token: string; expires_in: number };
    appToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    return appToken.value;
}

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get('query')?.trim();
    const searching = query !== undefined;
    const name = searching ? query : request.nextUrl.searchParams.get('name')?.trim();
    const empty = searching ? { categories: [] } : { imageUrl: null };
    if (!name || name.length > 200 || (searching && name.length < 2)) return NextResponse.json(empty, { status: 400 });

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json(empty, { status: 401 });

        const clientId = process.env.TWITCH_CLIENT_ID;
        const clientSecret = process.env.TWITCH_CLIENT_SECRET;
        if (!clientId || !clientSecret) return NextResponse.json(empty, { status: 503 });

        const url = new URL(searching ? 'https://api.twitch.tv/helix/search/categories' : 'https://api.twitch.tv/helix/games');
        url.searchParams.set(searching ? 'query' : 'name', name);
        if (searching) url.searchParams.set('first', '5');
        const lookup = (token: string) => fetch(url, {
            headers: { 'Client-Id': clientId, Authorization: 'Bearer ' + token },
            cache: 'no-store',
        });
        const token = await getAppToken(clientId, clientSecret);
        let response = await lookup(token);
        if (response.status === 401) {
            if (appToken?.value === token) appToken = undefined;
            response = await lookup(await getAppToken(clientId, clientSecret));
        }
        if (!response.ok) return NextResponse.json(empty, { status: 502 });

        const { data } = await response.json() as { data: { id: string; name: string; box_art_url?: string }[] };
        if (searching) {
            return NextResponse.json({
                categories: data.slice(0, 5).map(category => ({
                    id: category.id,
                    name: category.name,
                    imageUrl: category.box_art_url?.startsWith('https://static-cdn.jtvnw.net/') ? category.box_art_url : null,
                })),
            });
        }
        const imageUrl = data[0]?.box_art_url?.replace('{width}', '144').replace('{height}', '192');
        return NextResponse.json({
            imageUrl: imageUrl?.startsWith('https://static-cdn.jtvnw.net/') ? imageUrl : null,
        });
    } catch {
        return NextResponse.json(empty, { status: 502 });
    }
}
