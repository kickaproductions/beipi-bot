type Draft={id:string;payload:unknown;updatedAt:string};
const memory=globalThis as typeof globalThis&{beipiDrafts?:Draft[]};
const drafts=memory.beipiDrafts??=[];memory.beipiDrafts=drafts;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return json(drafts)}
async function save(request:Request,update:boolean){const body=await request.json() as {id?:string;payload?:unknown};if(!body.payload)return json({error:'Draft details are missing.'},400);let draft=update?drafts.find(value=>value.id===body.id):undefined;if(update&&!draft)return json({error:'Draft not found.'},404);if(!draft){draft={id:crypto.randomUUID(),payload:body.payload,updatedAt:new Date().toISOString()};drafts.unshift(draft)}else{draft.payload=body.payload;draft.updatedAt=new Date().toISOString()}return json(draft,update?200:201)}
export const POST=(request:Request)=>save(request,false);
export const PATCH=(request:Request)=>save(request,true);
export async function DELETE(request:Request){const id=new URL(request.url).searchParams.get('id');const index=drafts.findIndex(value=>value.id===id);if(index<0)return json({error:'Draft not found.'},404);drafts.splice(index,1);return json({ok:true})}
