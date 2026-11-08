import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const PORT=process.env.PORT||3000;
const HOST='0.0.0.0';
const COOKIE='ulimi_admin_access';
const MAX_AGE=8*60*60;
const SUPABASE_URL=(process.env.SUPABASE_URL||'https://pwoyfialzlwxamhawfyy.supabase.co').replace(/\/$/,'');
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_KBnv1nmCc_iKGcTro_Z-aQ_uhW8Qv5J';

app.use(express.json({limit:'20kb'}));

app.use((req, res, next) => {
  if (/\.(?:html|css|js)$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

function readCookie(req,name){
  for(const item of (req.headers.cookie||'').split(';')){
    const index=item.indexOf('=');
    if(index>0&&item.slice(0,index).trim()===name)return decodeURIComponent(item.slice(index+1).trim());
  }
  return '';
}

async function isAdmin(token){
  if(!SUPABASE_URL||!SUPABASE_KEY||!token)return false;
  try{
    const userResponse=await fetch(SUPABASE_URL+'/auth/v1/user',{
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token}
    });
    if(!userResponse.ok)return false;
    const user=await userResponse.json();
    const profileResponse=await fetch(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id)+'&select=role',{
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token}
    });
    if(!profileResponse.ok)return false;
    const profiles=await profileResponse.json();
    return profiles.length===1&&profiles[0].role==='admin';
  }catch{return false;}
}

async function requireAdmin(req,res,next){
  if(await isAdmin(readCookie(req,COOKIE)))return next();
  if(req.path.startsWith('/api/'))return res.status(401).json({ok:false,message:'Administrator access is required.'});
  return res.redirect('/login.html');
}

app.post('/api/admin/session',async(req,res)=>{
  const authorization=req.headers.authorization||'';
  const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  if(!await isAdmin(token))return res.status(403).json({ok:false,message:'This account does not have administrator access.'});
  const secure=process.env.NODE_ENV==='production'?'Secure; ':'';
  res.setHeader('Set-Cookie',COOKIE+'='+encodeURIComponent(token)+'; HttpOnly; '+secure+'SameSite=Strict; Path=/; Max-Age='+MAX_AGE);
  return res.json({ok:true});
});

app.post('/api/admin/logout',(_req,res)=>{
  const secure=process.env.NODE_ENV==='production'?'Secure; ':'';
  res.setHeader('Set-Cookie',COOKIE+'=; HttpOnly; '+secure+'SameSite=Strict; Path=/; Max-Age=0');
  return res.json({ok:true});
});

// These checks run before static hosting so the admin HTML cannot be fetched directly.
app.get(['/admin','/admin/'],requireAdmin,(_req,res)=>res.sendFile(path.join(__dirname,'pages','admin.html')));
app.get('/pages/admin.html',requireAdmin,(_req,res)=>res.sendFile(path.join(__dirname,'pages','admin.html')));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use(express.static(__dirname, { extensions: ['html'], index: 'index.html' }));
app.get('/:page', (req, res, next) => {
  const publicPagePath = path.join(__dirname, 'public', 'pages', req.params.page + '.html');
  if (fs.existsSync(publicPagePath) && req.params.page !== 'admin') return res.sendFile(publicPagePath);
  const pagePath = path.join(__dirname, 'pages', req.params.page + '.html');
  if (fs.existsSync(pagePath) && req.params.page !== 'admin') return res.sendFile(pagePath);
  next();
});
app.get('*',(req,res)=>{
  if(path.extname(req.path))return res.status(404).type('text/plain').send('Requested file was not found.');
  return res.sendFile(path.join(__dirname,'index.html'));
});

app.listen(PORT,HOST,()=>console.log('Malawian Agriculture running on http://'+HOST+':'+PORT));
