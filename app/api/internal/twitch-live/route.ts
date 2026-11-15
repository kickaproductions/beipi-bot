import { createHmac, timingSafeEqual } from 'node:crypto';
import { twitchAppFetch } from '@/lib/twitch-app';

export const runtime = 'nodejs';

type TwitchStream = { user_id: string; user_login: string; type: string; title: string; game_name: string };

export async function POST(request: Request) {
    const secret = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    if (!secret) return new Response(null, { status: 503 });

    const timestamp = request.headers.get('x-beipi-timestamp') ?? '';
    const signature = request.headers.get('x-beipi-signature') ?? '';
    if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 60_000 || !/^[a-f0-9]{64}$/.test(signature)) {
        return new Response(null, { status: 401 });
    }

    const body = await request.text();
    if (body.length > 3_000) return new Response(null, { status: 413 });
    const digest = createHmac('sha256', secret).update(`beipi-twitch-live-v1\n${timestamp}\n${body}`).digest();
    if (!timingSafeEqual(digest, Buffer.from(signature, 'hex'))) return new Response(null, { status: 401 });

    let ids: unknown;
    try { ids = JSON.parse(body); }
    catch { return new Response(null, { status: 400 }); }
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 ||
        ids.some(id => typeof id !== 'string' || !/^\d{1,20}$/.test(id))) {
        return new Response(null, { status: 400 });
    }

    try {
        const url = new URL('https://api.twitch.tv/helix/streams');
        url.searchParams.set('first', '100');
        for (const id of new Set(ids)) url.searchParams.append('user_id', id);
        const response = await twitchAppFetch(url);
        if (!response.ok) return new Response(null, { status: 502 });
        const result = await response.json() as { data: TwitchStream[] };
        if (!Array.isArray(result.data)) return new Response(null, { status: 502 });
        return Response.json(result.data.filter(stream => stream.type === 'live').map(stream => ({
            id: stream.user_id,
            name: 'Twitch',
            details: stream.title,
            state: stream.game_name,
            url: `https://www.twitch.tv/${encodeURIComponent(stream.user_login)}`,
        })), { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return new Response(null, { status: 502 });
    }
}
