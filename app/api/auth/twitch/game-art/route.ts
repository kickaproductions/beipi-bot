import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import { twitchAppFetch } from '@/lib/twitch-app';

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

        if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
            return NextResponse.json(empty, { status: 503 });
        }

        const url = new URL(searching ? 'https://api.twitch.tv/helix/search/categories' : 'https://api.twitch.tv/helix/games');
        url.searchParams.set(searching ? 'query' : 'name', name);
        if (searching) url.searchParams.set('first', '5');
        const response = await twitchAppFetch(url);
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
        const imageUrl = data[0]?.box_art_url?.replace('{width}', '240').replace('{height}', '320');
        return NextResponse.json({
            imageUrl: imageUrl?.startsWith('https://static-cdn.jtvnw.net/') ? imageUrl : null,
        });
    } catch {
        return NextResponse.json(empty, { status: 502 });
    }
}
