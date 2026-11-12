'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function StreamGameArt({ game }: { game: string }) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/auth/twitch/game-art?' + new URLSearchParams({ name: game }), {
            signal: controller.signal,
        })
            .then(async response => {
                if (!response.ok) return;
                const data = await response.json() as { imageUrl: string | null };
                if (!controller.signal.aborted) setImageUrl(data.imageUrl);
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [game]);

    return imageUrl ? (
        <Image
            className="stream-game-art"
            src={imageUrl}
            alt=""
            width={120}
            height={160}
            unoptimized
            onError={() => setImageUrl(null)}
        />
    ) : null;
}
