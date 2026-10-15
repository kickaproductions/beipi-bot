import { z } from 'zod';
export const draftSchema=z.object({
  type:z.enum(['channel','reaction']), title:z.string().trim().min(1).max(100),
  server:z.string().trim().min(1).max(100), mode:z.enum(['existing','new']),
  serverId:z.string().max(30).optional(), channelId:z.string().max(30).optional(),
  channel:z.string().trim().min(1).max(100), category:z.string().max(100).default(''),
  text:z.string().max(2000), bannerId:z.string().uuid().nullable(), bannerAlt:z.string().trim().max(300).default(''),
  reactions:z.array(z.object({emoji:z.string().trim().min(1).max(100),role:z.string().trim().min(1).max(100)})).max(20),
  removeOnUnreact:z.boolean(),
}).superRefine((value,ctx)=>{
  if(value.mode==='new'&&!/^[a-z0-9_-]+$/.test(value.channel))ctx.addIssue({code:'custom',path:['channel'],message:'Use lowercase letters, numbers, hyphens or underscores for a new channel.'});
  if(value.type==='reaction'&&!value.reactions.length)ctx.addIssue({code:'custom',path:['reactions'],message:'Add at least one emoji and role.'});
  if(value.type==='channel'&&!value.text.trim()&&!value.bannerId)ctx.addIssue({code:'custom',path:['text'],message:'Add a banner or some text.'});
  if(value.bannerId&&!value.bannerAlt.trim())ctx.addIssue({code:'custom',path:['bannerAlt'],message:'Add a short image description for the banner.'});
  const emoji=value.reactions.map(r=>r.emoji);if(new Set(emoji).size!==emoji.length)ctx.addIssue({code:'custom',path:['reactions'],message:'Use a different emoji for each role.'});
});
export type DraftPayload=z.infer<typeof draftSchema>;
export type SavedDraft={id:string;payload:DraftPayload;updatedAt:string};
