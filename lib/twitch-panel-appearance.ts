import {z} from 'zod';

export const twitchPanelAppearanceSchema=z.object({
  theme:z.enum(['violet','lavender','midnight']),
  accent:z.string().regex(/^#[0-9a-f]{6}$/i),
  title:z.string().trim().min(1).max(50),
  showPip:z.boolean(),
  layout:z.enum(['compact','roomy']),
});

export type TwitchPanelAppearance=z.infer<typeof twitchPanelAppearanceSchema>;

export const defaultTwitchPanelAppearance:TwitchPanelAppearance={
  theme:'violet',accent:'#bf8bed',title:'This week on stream',showPip:true,layout:'compact',
};

export function readTwitchPanelAppearance(value:unknown):TwitchPanelAppearance{
  const parsed=twitchPanelAppearanceSchema.safeParse(value);
  return parsed.success?parsed.data:defaultTwitchPanelAppearance;
}
