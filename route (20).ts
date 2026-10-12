type Item={id:string;kind:string;title:string;note:string;due:string|null;done:boolean;createdAt:string};
const memory=globalThis as typeof globalThis&{beipiItems?:Item[]};
const items=memory.beipiItems??=[];memory.beipiItems=items;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return json([...items].reverse())}
export async function POST(request:Request){const body=await request.json() as {kind?:string;title?:string;note?:string;due?:string|null};if(!body.title||!body.kind||!['reminder','checklist','idea','connection'].includes(body.kind))return json({error:'Check the title and try again.'},400);const item:Item={id:crypto.randomUUID(),kind:body.kind,title:String(body.title).slice(0,200),note:String(body.note??'').slice(0,2000),due:body.due??null,done:false,createdAt:new Date().toISOString()};items.push(item);return json(item,201)}
export async function PATCH(request:Request){const body=await request.json() as {id?:string;done?:boolean;due?:string|null};const item=items.find(value=>value.id===body.id);if(!item)return json({error:'Item not found.'},404);if(typeof body.done==='boolean')item.done=body.done;if(body.due===null||typeof body.due==='string')item.due=body.due;return json(item)}
export async function DELETE(request:Request){const id=new URL(request.url).searchParams.get('id');const index=items.findIndex(value=>value.id===id);if(index<0)return json({error:'Item not found.'},404);items.splice(index,1);return json({ok:true})}
