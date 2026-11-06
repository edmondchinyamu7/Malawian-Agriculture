const SUPABASE_URL=(process.env.SUPABASE_URL||'https://pwoyfialzlwxamhawfyy.supabase.co').replace(/\/$/,'');
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_KBnv1nmCc_iKGcTro_Z-aQ_uhW8Qv5J';
export const ADMIN_COOKIE='ulimi_admin_access';
export async function isAdminToken(token){
 if(!token)return false;
 try{
  const u=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token}});
  if(!u.ok)return false;
  const user=await u.json();
  const p=await fetch(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id)+'&select=role',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token}});
  if(!p.ok)return false;
  const rows=await p.json();
  return rows.length===1&&rows[0].role==='admin';
 }catch{return false;}
}
export function cookieToken(req){
 const raw=req.headers.cookie||'';
 for(const part of raw.split(';')){
  const i=part.indexOf('=');
  if(i>0&&part.slice(0,i).trim()===ADMIN_COOKIE)return decodeURIComponent(part.slice(i+1).trim());
 }
 return '';
}
