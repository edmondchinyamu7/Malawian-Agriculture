import { supabase } from './auth.js';
const root=document.getElementById('planCards');
const status=document.getElementById('plansStatus');
const money=n=>'MWK '+Number(n||0).toLocaleString('en-MW');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadPlans(){
 const {data,error}=await supabase.from('subscription_plans').select('id,name,monthly_price_mwk,description,features,ads_enabled,display_order').eq('active',true).order('display_order');
 if(error){status.textContent='Membership plans are temporarily unavailable. Please try again later.';status.classList.add('error');return;}
 root.innerHTML=(data||[]).map(p=>{
  const features=Array.isArray(p.features)?p.features:[];
  const featured=p.id==='professional';
  return '<article class="plan-card '+(featured?'featured':'')+'">'+(featured?'<span class="plan-label">Recommended</span>':'<span class="plan-label">&nbsp;</span>')+'<h2>'+esc(p.name)+'</h2><div class="plan-price">'+money(p.monthly_price_mwk)+' <small>/ month</small></div><p class="plan-description">'+esc(p.description)+'</p><ul class="plan-features">'+features.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul><p class="plan-ad-note">'+(p.ads_enabled?'Advertisements may appear in the free/standard experience.':'Advertisement-free plan.')+'</p></article>';
 }).join('');
 status.textContent='Four membership levels are configured. Secure payment activation is not yet enabled.';
}
loadPlans();
