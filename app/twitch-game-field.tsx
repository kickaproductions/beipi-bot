'use client';

import Image from 'next/image';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';

type Category = { id: string; name: string; imageUrl: string | null };
type SearchResult = { query: string; categories: Category[]; unavailable?: boolean };

export default function TwitchGameField({ initialGame }: { initialGame: string }) {
    const id = useId();
    const listId = id + '-categories';
    const [game, setGame] = useState(initialGame);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [result, setResult] = useState<SearchResult>();
    const query = game.trim();
    const search = open && query.length >= 2;
    const current = search && result?.query === query ? result : undefined;
    const categories = current?.categories ?? [];
    const expanded = categories.length > 0;

    useEffect(() => {
        if (!search) return;

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch('/api/auth/twitch/game-art?' + new URLSearchParams({ query }), {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error('Category lookup failed');
                const { categories } = await response.json() as { categories: Category[] };
                if (!controller.signal.aborted) setResult({ query, categories });
            } catch {
                if (!controller.signal.aborted) setResult({ query, categories: [], unavailable: true });
            }
        }, 250);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, search]);

    function close() {
        setOpen(false);
        setActive(-1);
    }

    function choose(category: Category) {
        setGame(category.name);
        close();
    }

    function handleKey(event: KeyboardEvent<HTMLInputElement>) {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape' && search) {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (query.length < 2) return;
            event.preventDefault();
            setOpen(true);
            if (expanded) {
                setActive(event.key === 'ArrowDown'
                    ? Math.min(active + 1, categories.length - 1)
                    : active < 0 ? categories.length - 1 : Math.max(0, active - 1));
            }
        } else if (event.key === 'Enter' && expanded && categories[active]) {
            event.preventDefault();
            choose(categories[active]);
        }
    }

    return (
        <div className="twitch-game-field">
            <label htmlFor={id}>Game name</label>
            <input
                id={id}
                name="game"
                required
                maxLength={120}
                placeholder="What are you streaming?"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={expanded}
                aria-controls={expanded ? listId : undefined}
                aria-activedescendant={expanded && categories[active] ? listId + '-' + active : undefined}
                value={game}
                onChange={event => {
                    setGame(event.currentTarget.value);
                    setActive(-1);
                    setOpen(true);
                }}
                onBlur={close}
                onKeyDown={handleKey}
            />
            {expanded && (
                <ul id={listId} role="listbox" aria-label="Twitch categories">
                    {categories.map((category, index) => (
                        <li
                            key={category.id}
                            id={listId + '-' + index}
                            role="option"
                            aria-selected={index === active}
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => choose(category)}
                        >
                            {category.imageUrl && <Image src={category.imageUrl} alt="" width={24} height={32} unoptimized/>}
                            {category.name}
                        </li>
                    ))}
                </ul>
            )}
            {search && <small role="status">
                {expanded ? `${categories.length} Twitch suggestions. Use the arrow keys to browse.` : current?.unavailable
                    ? 'Twitch suggestions are unavailable. You can still enter a game name.'
                    : current ? 'No matching Twitch categories. You can still enter a game name.' : 'Searching Twitch…'}
            </small>}
        </div>
    );
}
