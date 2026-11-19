import { DISCORD_MESSAGE_CONTENT_LIMIT } from './discord-message-limits';

export const DISCORD_ROLE_TAG_PATTERN = /<@&(\d{1,20})>/g;

export function discordMessageRoleIds(text: string) {
  return [...new Set(Array.from(text.matchAll(DISCORD_ROLE_TAG_PATTERN), match => match[1]))];
}

export function discordRoleTag(roleId: string) {
  return `<@&${roleId}>`;
}

export function discordRoleTagError(text: string) {
  const roleIds = discordMessageRoleIds(text);
  if (roleIds.length > 100 || roleIds.map(discordRoleTag).join(' ').length > DISCORD_MESSAGE_CONTENT_LIMIT) {
    return 'Remove some role tags before publishing this message.';
  }
}

export function discordMessageWithRoleTags(text: string) {
  const roles = discordMessageRoleIds(text);
  const allowed_mentions = { parse: [], roles };
  if (text.length <= DISCORD_MESSAGE_CONTENT_LIMIT) return { content: text, allowed_mentions };

  // Discord sends role notifications from message content, so include tags above the embed.
  const content = roles.length ? roles.map(discordRoleTag).join(' ') : undefined;
  return { content, embeds: [{ description: text }], allowed_mentions };
}
