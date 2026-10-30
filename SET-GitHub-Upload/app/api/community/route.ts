import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { communityPosts, friendRequests, friendships, profiles } from "../../../db/schema";

const publicProfile={code:profiles.code,name:profiles.name,avatar:profiles.avatar};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});

const CODE=/^SET-[A-Z2-9]{4}$/;
const ANON=/^[0-9a-f-]{20,80}$/i;
const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode=()=>"SET-"+Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>chars[n%chars.length]).join("");

function ownerId(request:Request){
  const signed=request.headers.get("oai-authenticated-user-id");
  if(signed)return `user:${signed}`;
  const anon=request.headers.get("x-set-anonymous-id")||"";
  return ANON.test(anon)?`anon:${anon}`:"";
}

async function ensureProfile(id:string){
  const db=getDb();
  const existing=await db.select().from(profiles).where(eq(profiles.ownerId,id)).limit(1);
  if(existing[0])return existing[0];
  for(let attempt=0;attempt<8;attempt++){
    try{const [created]=await db.insert(profiles).values({ownerId:id,code:newCode()}).returning();return created;}catch(error){if(attempt===7)throw error;}
  }
  throw new Error("Profil konnte nicht erstellt werden");
}

async function profileByCode(code:string){
  const rows=await getDb().select({ownerId:profiles.ownerId,...publicProfile}).from(profiles).where(eq(profiles.code,code)).limit(1);
  return rows[0]||null;
}

export async function GET(request:Request){
  const id=ownerId(request);if(!id)return Response.json({error:"identity required"},{status:401});
  const url=new URL(request.url),action=url.searchParams.get("action")||"init",me=await ensureProfile(id),db=getDb();
  if(action==="search"){
    const q=(url.searchParams.get("q")||"").trim().slice(0,80),upper=q.toUpperCase();
    if(!q)return Response.json({profiles:[]});
    const rows=await db.select(publicProfile).from(profiles).where(or(eq(profiles.code,upper),like(profiles.name,`%${q}%`))).limit(20);
    return json({profiles:rows.filter(p=>p.code!==me.code)});
  }
  const links=await db.select(publicProfile).from(friendships).innerJoin(profiles,eq(friendships.friendCode,profiles.code)).where(eq(friendships.ownerId,id)).limit(500);
  const friendOwners=await db.select({ownerId:profiles.ownerId}).from(friendships).innerJoin(profiles,eq(friendships.friendCode,profiles.code)).where(eq(friendships.ownerId,id)).limit(500);
  const postOwners=[id,...friendOwners.map(p=>p.ownerId)];
  const posts=await db.select({id:communityPosts.id,ownerId:communityPosts.ownerId,date:communityPosts.date,capturedAt:communityPosts.capturedAt,image:communityPosts.image,workoutName:communityPosts.workoutName,createdAt:communityPosts.createdAt,name:profiles.name,avatar:profiles.avatar,code:profiles.code}).from(communityPosts).innerJoin(profiles,eq(communityPosts.ownerId,profiles.ownerId)).where(or(...postOwners.map(owner=>eq(communityPosts.ownerId,owner)))).orderBy(desc(communityPosts.createdAt)).limit(120);
  const requests=await db.select({...publicProfile,createdAt:friendRequests.createdAt}).from(friendRequests).innerJoin(profiles,eq(friendRequests.senderId,profiles.ownerId)).where(eq(friendRequests.recipientId,id)).orderBy(desc(friendRequests.createdAt),profiles.code);
  const sent=await db.select({code:profiles.code}).from(friendRequests).innerJoin(profiles,eq(friendRequests.recipientId,profiles.ownerId)).where(eq(friendRequests.senderId,id));
  return json({profile:{code:me.code,name:me.name,avatar:me.avatar},friends:links,requests,sent:sent.map(p=>p.code),posts});
}

export async function POST(request:Request){
  const id=ownerId(request);if(!id)return Response.json({error:"identity required"},{status:401});
  const body=await request.json() as {action?:string;code?:string;name?:string;avatar?:string;names?:string[];post?:{id?:string;date?:string;capturedAt?:string;image?:string;workoutName?:string}};
  const me=await ensureProfile(id),db=getDb();
  if(body.action==="update-name"){
    const name=(body.name||"").trim().slice(0,40);
    await db.update(profiles).set({name,updatedAt:new Date().toISOString()}).where(eq(profiles.ownerId,id));
    return Response.json({profile:{code:me.code,name}});
  }
  if(body.action==="update-avatar"){
    const avatar=body.avatar;
    if(typeof avatar!=="string"||avatar.length>180000||(avatar!==""&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar)))return json({error:"Ungültiges Profilbild"},400);
    await db.update(profiles).set({avatar,updatedAt:new Date().toISOString()}).where(eq(profiles.ownerId,id));
    return json({ok:true});
  }
  if(body.action==="save-post"){
    const post=body.post||{},image=post.image||"",date=post.date||"",workoutName=(post.workoutName||"Freies Training").trim().slice(0,80),capturedAt=post.capturedAt||new Date().toISOString();
    if(typeof post.id!=="string"||post.id.length<8||post.id.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(date)||typeof image!=="string"||image.length>180000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||Number.isNaN(Date.parse(capturedAt)))return json({error:"Ungültiger Community-Beitrag"},400);
    await db.delete(communityPosts).where(and(eq(communityPosts.ownerId,id),eq(communityPosts.date,date)));
    const createdAt=new Date().toISOString();
    await db.insert(communityPosts).values({id:post.id,ownerId:id,date,capturedAt,image,workoutName,createdAt});
    return json({post:{id:post.id,ownerId:id,date,capturedAt,image,workoutName,createdAt,name:me.name,avatar:me.avatar,code:me.code}});
  }
  if(body.action==="delete-post"){
    const postId=body.post?.id||"";if(typeof postId!=="string"||postId.length>100)return json({error:"Ungültiger Beitrag"},400);
    await db.delete(communityPosts).where(and(eq(communityPosts.id,postId),eq(communityPosts.ownerId,id)));
    return json({ok:true});
  }
  if(["send-request","accept-request","decline-request"].includes(body.action||"")){
    const code=(body.code||"").toUpperCase();
    if(!CODE.test(code)||code===me.code)return json({error:"Ungültiges Profil"},400);
    const person=await profileByCode(code);if(!person)return json({error:"Profil nicht gefunden"},404);
    if(body.action==="send-request"){
      // Insert only if the pair is not already friends; repeated sends are idempotent.
      await db.run(sql`INSERT OR IGNORE INTO friend_requests (sender_id,recipient_id,created_at)
        SELECT ${id},${person.ownerId},${new Date().toISOString()}
        WHERE NOT EXISTS (SELECT 1 FROM friendships WHERE owner_id=${id} AND friend_code=${code})`);
      return json({ok:true});
    }
    const incoming=and(eq(friendRequests.senderId,person.ownerId),eq(friendRequests.recipientId,id));
    if(body.action==="decline-request"){
      await db.delete(friendRequests).where(incoming);
      return json({ok:true});
    }
    // D1 batch is atomic. Only the recipient can accept an existing incoming request.
    // Conditional inserts prevent a concurrent decline from creating a friendship.
    const accepted=await env.DB!.batch([
      env.DB!.prepare('INSERT OR IGNORE INTO friendships (owner_id,friend_code) SELECT ?,? WHERE EXISTS (SELECT 1 FROM friend_requests WHERE sender_id=? AND recipient_id=?)').bind(id,code,person.ownerId,id),
      env.DB!.prepare('INSERT OR IGNORE INTO friendships (owner_id,friend_code) SELECT ?,? WHERE EXISTS (SELECT 1 FROM friend_requests WHERE sender_id=? AND recipient_id=?)').bind(person.ownerId,me.code,person.ownerId,id),
      env.DB!.prepare('DELETE FROM friend_requests WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)').bind(person.ownerId,id,id,person.ownerId),
      env.DB!.prepare('SELECT friend_code FROM friendships WHERE owner_id=? AND friend_code=?').bind(id,code),
    ]);
    if(!accepted[3].results.length)return json({error:"Diese Anfrage ist nicht mehr offen."},409);
    return json({friend:{code:person.code,name:person.name,avatar:person.avatar}});
  }
  if(body.action==="add-friend"){
    const code=(body.code||"").toUpperCase();if(!CODE.test(code)||code===me.code)return Response.json({error:"invalid code"},{status:400});
    const friend=await profileByCode(code);if(!friend)return Response.json({error:"profile not found"},{status:404});
    await db.batch([
      db.insert(friendships).values([{ownerId:id,friendCode:code},{ownerId:friend.ownerId,friendCode:me.code}]).onConflictDoNothing(),
      db.delete(friendRequests).where(or(and(eq(friendRequests.senderId,id),eq(friendRequests.recipientId,friend.ownerId)),and(eq(friendRequests.senderId,friend.ownerId),eq(friendRequests.recipientId,id)))),
    ]);
    return json({friend:{code:friend.code,name:friend.name,avatar:friend.avatar}});
  }
  if(body.action==="match-contacts"){
    const names=(body.names||[]).map(n=>n.trim()).filter(Boolean).slice(0,100);
    if(!names.length)return Response.json({profiles:[]});
    const rows=await db.select(publicProfile).from(profiles).where(or(...names.map(name=>eq(profiles.name,name)))).limit(100);
    return Response.json({profiles:rows.filter(p=>p.code!==me.code)});
  }
  return Response.json({error:"unknown action"},{status:400});
}
