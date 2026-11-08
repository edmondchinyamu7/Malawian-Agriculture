import { supabase } from './auth.js';

const $ = (id) => document.getElementById(id);
const money = (value) => 'MWK ' + Number(value || 0).toLocaleString('en-MW',{maximumFractionDigits:2});
const dateOnly = (value) => value ? new Date(value).toLocaleDateString('en-GB') : '—';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthStart = (month) => month + '-01';
const nextMonth = (month) => { const d = new Date(month + '-01T00:00:00'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,10); };

function setStatus(message, error=false){ const el=$('financeStatus'); el.textContent=message; el.classList.toggle('error',error); }
function setText(id,value){ const el=$(id); if(el) el.textContent=value; }

async function requireAdmin(){
  const {data:{user},error}=await supabase.auth.getUser();
  if(error || !user){ location.replace('/login.html'); return null; }
  const {data:marker,error:markerError}=await supabase.from('admin_access').select('user_id').eq('user_id',user.id).maybeSingle();
  if(markerError || !marker){ setStatus('Administrator access could not be verified. Please sign in with the authorised administrator account.',true); return null; }
  return user;
}

async function loadDashboard(){
  const month=$('reportMonth').value || new Date().toISOString().slice(0,7);
  const from=monthStart(month), to=nextMonth(month);
  setStatus('Loading verified records for ' + month + '…');
  const results=await Promise.all([
    supabase.from('profiles').select('id,role,created_at'),
    supabase.from('app_activity_events').select('user_id,activity_date').gte('activity_date',from).lt('activity_date',to),
    supabase.from('subscriptions').select('id,user_id,plan_id,status,expires_at,created_at,updated_at,plan:subscription_plans(name,monthly_price_mwk)'),
    supabase.from('revenue_entries').select('*').gte('received_at',from).lt('received_at',to).order('received_at',{ascending:false}),
    supabase.from('expense_entries').select('*').gte('spent_at',from).lt('spent_at',to).order('spent_at',{ascending:false}),
    supabase.from('subscription_plans').select('*').eq('active',true).order('display_order'),
    Promise.resolve({data:[],error:null})
  ]);
  const error=results.find(r=>r.error);
  if(error){ setStatus('Unable to load dashboard data: '+error.error.message,true); return; }
  const [profiles,activity,allSubs,revenue,expenses,plans]=results.slice(0,6).map(r=>r.data||[]);
  const uniqueActive=new Set(activity.map(x=>x.user_id)).size;
  const activeSubs=allSubs.filter(s=>s.status==='active' && s.plan_id!=='free' && (!s.expires_at || new Date(s.expires_at)>=new Date()));
  const paidActive=activeSubs.length;
  const farmerCount=profiles.filter(p=>p.role!=='admin').length;
  const freeProfiles=Math.max(0,farmerCount-paidActive);
  const monthSubs=allSubs.filter(s=>s.created_at>=from && s.created_at<to);
  const totalRevenue=revenue.reduce((n,x)=>n+Number(x.amount_mwk),0);
  const totalExpenses=expenses.reduce((n,x)=>n+Number(x.amount_mwk),0);
  setText('totalUsers',profiles.length.toLocaleString());
  setText('userBreakdown',freeProfiles+' free/other accounts • '+paidActive+' active paid subscriptions');
  setText('activeUsers',uniqueActive.toLocaleString());
  setText('activeSubs',paidActive.toLocaleString());
  const tiers=activeSubs.reduce((a,s)=>(a[s.plan_id]=(a[s.plan_id]||0)+1,a),{});
  setText('tierBreakdown',plans.filter(p=>p.id!=='free').map(p=>(tiers[p.id]||0)+' '+p.name).join(' • ')||'No paid plans configured');
  setText('totalRevenue',money(totalRevenue));
  setText('totalExpenses',money(totalExpenses));
  const result=totalRevenue-totalExpenses;
  setText('operatingResult',(result<0?'-':'')+money(Math.abs(result)));
  $('operatingResult').style.color=result<0?'#a52b25':'#0b6245';

  const sources=[['Subscriptions','subscription'],['Advertising','advertising'],['Partnerships','partnership'],['Other','other']];
  $('revenueBreakdown').innerHTML=sources.map(([label,key])=>{const total=revenue.filter(x=>x.source===key).reduce((n,x)=>n+Number(x.amount_mwk),0);return '<div class="finance-breakdown-row"><span>'+label+'</span><strong>'+money(total)+'</strong></div>';}).join('');
  const statuses=['active','pending','cancelled','expired','past_due','refunded'];
  $('subscriptionBreakdown').innerHTML=statuses.map(s=>'<div class="finance-breakdown-row"><span>'+s.replace('_',' ')+'</span><strong>'+allSubs.filter(x=>x.status===s).length+'</strong></div>').join('')+'<div class="finance-breakdown-row"><span>New subscriptions this month</span><strong>'+monthSubs.length+'</strong></div>';
  $('revenueRows').innerHTML=revenue.length?revenue.slice(0,12).map(x=>'<tr><td>'+dateOnly(x.received_at)+'</td><td>'+esc(x.source)+'</td><td>'+money(x.amount_mwk)+'</td><td>'+esc(x.reference||x.notes||'—')+'</td></tr>').join(''):'<tr><td colspan="4">No revenue entries for this month.</td></tr>';
  $('expenseRows').innerHTML=expenses.length?expenses.slice(0,12).map(x=>'<tr><td>'+dateOnly(x.spent_at)+'</td><td>'+esc(x.category)+'</td><td>'+money(x.amount_mwk)+'</td><td>'+esc(x.description)+'</td></tr>').join(''):'<tr><td colspan="4">No expense entries for this month.</td></tr>';
  $('planRows').innerHTML=plans.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+money(p.monthly_price_mwk)+'</td><td>'+(p.ads_enabled?'Shown':'Off')+'</td><td>'+(p.active?'Active':'Inactive')+'</td></tr>').join('');
  setStatus('Dashboard updated. Figures include records currently stored in Supabase for '+month+'.');
}

async function start(){
  $('reportMonth').value=new Date().toISOString().slice(0,7);
  const user=await requireAdmin(); if(!user)return;
  $('financeLogout').addEventListener('click',async()=>{await supabase.auth.signOut();await fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});location.assign('/login.html');});
  $('reportMonth').addEventListener('change',loadDashboard);
  $('revenueDate').value=new Date().toISOString().slice(0,10);
  $('expenseDate').value=new Date().toISOString().slice(0,10);
  $('revenueForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const {data:{user}}=await supabase.auth.getUser();
    const row={source:$('revenueSource').value,amount_mwk:Number($('revenueAmount').value),received_at:new Date($('revenueDate').value+'T12:00:00').toISOString(),reference:$('revenueNote').value.trim()||null,created_by:user.id};
    const {error}=await supabase.from('revenue_entries').insert(row);
    if(error){setStatus('Could not save revenue: '+error.message,true);return;}
    e.target.reset();$('revenueDate').value=new Date().toISOString().slice(0,10);await loadDashboard();
  });
  $('expenseForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const {data:{user}}=await supabase.auth.getUser();
    const row={category:$('expenseCategory').value,amount_mwk:Number($('expenseAmount').value),spent_at:$('expenseDate').value,description:$('expenseDescription').value.trim(),created_by:user.id};
    const {error}=await supabase.from('expense_entries').insert(row);
    if(error){setStatus('Could not save expense: '+error.message,true);return;}
    e.target.reset();$('expenseDate').value=new Date().toISOString().slice(0,10);await loadDashboard();
  });
  await loadDashboard();
}
start();
