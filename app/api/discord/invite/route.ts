import {NextRequest,NextResponse} from 'next/server';

export const runtime='nodejs';

// Manage Channels, Add Reactions, View Channels, Send Messages, Embed Links,
// Attach Files, Read History, Mention Everyone, External Emoji, Manage Roles,
// and Manage Events. Deliberately does not request Administrator.
const BEIPI_PERMISSIONS='8858881104';

export async function GET(request:NextRequest){
  const clientId=process.env.DISCORD_CLIENT_ID;
  if(!clientId){
    const home=new URL('/',request.nextUrl.origin);
    home.searchParams.set('discord','not-configured');
    return NextResponse.redirect(home);
  }

  const authorize=new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id',clientId);
  authorize.searchParams.set('scope','bot applications.commands');
  authorize.searchParams.set('permissions',BEIPI_PERMISSIONS);
  authorize.searchParams.set('integration_type','0');
  return NextResponse.redirect(authorize);
}
