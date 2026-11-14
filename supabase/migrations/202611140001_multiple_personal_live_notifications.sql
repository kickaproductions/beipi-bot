alter table public.discord_owner_live_settings
  drop constraint if exists discord_owner_live_settings_user_id_guild_id_key;

create index if not exists discord_owner_live_settings_user_guild_idx
  on public.discord_owner_live_settings (user_id, guild_id);
