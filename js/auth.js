import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const supabase=createClient('https://pwoyfialzlwxamhawfyy.supabase.co','sb_publishable_KBnv1nmCc_iKGcTro_Z-aQ_uhW8Qv5J',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.ulimiSupabase=supabase;
const $=id=>document.getElementById(id);
const initials=(a,b)=>((String(a||'')[0]||'')+(String(b||'')[0]||'')).toUpperCase()||'U';
async function account(){
 const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const {data:profile,error}=await supabase.from('profiles').select('first_name,last_name,role').eq('id',user.id).single();
 if(error)throw error;return {user,profile};
}
async function init(){
 try{const a=await account();const login=$('accountLoginLink'),menu=$('profileMenu'),button=$('profileMenuButton');
 if(login&&menu&&button){login.hidden=!!a;menu.hidden=!a;if(a){button.textContent=initials(a.profile.first_name,a.profile.last_name);button.title=[a.profile.first_name,a.profile.last_name].filter(Boolean).join(' ')||a.user.email;}}
 }catch(e){console.warn('Account profile unavailable:',e.message);}
 const button=$('profileMenuButton'),drop=$('profileDropdown');
 if(button&&drop){button.addEventListener('click',()=>{drop.hidden=!drop.hidden;button.setAttribute('aria-expanded',String(!drop.hidden));});document.addEventListener('click',e=>{if(!e.target.closest('#profileMenu')){drop.hidden=true;button.setAttribute('aria-expanded','false');}});}
 const logout=$('accountLogoutButton');if(logout)logout.addEventListener('click',async()=>{await supabase.auth.signOut();await fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});location.assign('/login.html');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){const l=$('accountLoginLink'),m=$('profileMenu');if(l)l.hidden=false;if(m)m.hidden=true;}else if(session)setTimeout(init,0);});
