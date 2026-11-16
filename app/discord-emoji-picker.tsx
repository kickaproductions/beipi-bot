'use client';

import dynamic from 'next/dynamic';
import {useEffect, useState} from 'react';
import type {CustomEmoji} from 'emoji-picker-react';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <p className="loading">Loading emoji library…</p>,
});

export function ReactionEmoji({value}: {value: string}) {
  const custom = /^([a-z0-9_]+):(\d{17,20})$/i.exec(value);
  if (!custom) return value || '＋';
  return <img className="discord-reaction-emoji" src={`https://cdn.discordapp.com/emojis/${custom[2]}.png?size=32`} width={20} height={20} alt={`:${custom[1]}:`}/>;
}

export default function DiscordEmojiPicker({guildId, onSelect, onClose}: {
  guildId?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [server, setServer] = useState<{guildId: string; emojis: CustomEmoji[]; error?: string}>();

  useEffect(() => {
    if (!guildId) return;
    const request = new AbortController();
    async function loadServerEmoji(id: string) {
      try {
        const response = await fetch('/api/auth/discord/emojis?guildId=' + encodeURIComponent(id), {
          cache: 'no-store',
          signal: request.signal,
        });
        const data = await response.json() as {emojis?: CustomEmoji[]; error?: string};
        if (!response.ok) throw new Error(data.error || 'Server emoji could not be loaded.');
        if (!request.signal.aborted) setServer({guildId: id, emojis: data.emojis || []});
      } catch (error) {
        if (!request.signal.aborted) {
          setServer({guildId: id, emojis: [], error: error instanceof Error ? error.message : 'Server emoji could not be loaded.'});
        }
      }
    }
    void loadServerEmoji(guildId);
    return () => request.abort();
  }, [guildId]);

  const serverEmoji = server?.guildId === guildId ? server : undefined;
  return (
    <div className="discord-emoji-library" onKeyDown={event => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
      if (event.key === 'Escape') {
        event.stopPropagation();
        const trigger = event.currentTarget.previousElementSibling;
        if (trigger instanceof HTMLElement) trigger.focus();
        onClose();
      }
    }}>
      <EmojiPicker
        width="100%"
        height={340}
        emojiStyle="native"
        customEmojis={serverEmoji?.emojis}
        onEmojiClick={emoji => onSelect(emoji.isCustom ? emoji.unified : emoji.emoji)}
        previewConfig={{showPreview: false}}
        searchPlaceholder="Search emoji"
        lazyLoadEmojis
      />
      {guildId && !serverEmoji && <small className="discord-emoji-status" role="status">Loading server emoji…</small>}
      {serverEmoji?.error && <small className="discord-emoji-status" role="status">{serverEmoji.error}</small>}
    </div>
  );
}
