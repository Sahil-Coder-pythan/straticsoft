const $=id=>document.getElementById(id);
const fmtDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString()};
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('en-IN');
function rows(arr,cols,empty){return arr.length?arr.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+cols+'">'+empty+'</td></tr>'}
let timer=null;
async function loadStats(){
 const r=await fetch('/shop/api/admin/stats',{credentials:'same-origin'});
 if(r.status===401){$('dashboard').classList.add('hidden');$('login-panel').classList.remove('hidden');return}
 if(!r.ok)throw Error('Could not load dashboard data.');
 const d=await r.json();$('login-panel').classList.add('hidden');$('dashboard').classList.remove('hidden');$('load-error').textContent='';
 ['visits','users','activeNow','active24h','newUsers7d','sellers','products','buyers','orders'].forEach(k=>$(k).textContent=num(d[k]));
 const os=d.ordersByStatus||{};
 $('s-CONFIRMED').textContent=num(os.CONFIRMED);$('s-SD').textContent=num((os.SHIPPED||0)+(os.DELIVERED||0));$('s-CANCELLED').textContent=num(os.CANCELLED);
 const sc=Object.entries(d.salesByCurrency||{});
 $('sales').innerHTML=sc.length?sc.map(([c,v])=>'<b style="font-size:22px;color:#141414">'+esc(c)+' '+num(v)+'</b>').join(' &nbsp; + &nbsp; '):'No orders yet';
 const cr=Object.entries(d.byCountry||{}).sort((a,b)=>(b[1].users+b[1].products+b[1].orders)-(a[1].users+a[1].products+a[1].orders));
 const mx=Math.max(1,...cr.map(([,v])=>v.users));
 $('countries').innerHTML=rows(cr.map(([c,v])=>[esc(c),v.users,v.products,v.orders,'<div class="bar"><i style="width:'+Math.round(v.users/mx*100)+'%"></i></div>']),5,'No data yet');
 const ct=Object.entries(d.byCategory||{}).sort((a,b)=>b[1]-a[1]);const cm=Math.max(1,...ct.map(x=>x[1]));
 $('cats').innerHTML=rows(ct.map(([c,n])=>[esc(c),n,'<div class="bar"><i style="width:'+Math.round(n/cm*100)+'%"></i></div>']),3,'No products yet');
 $('recent-orders').innerHTML=rows((d.recentOrders||[]).map(o=>[esc(o.ref),'<span class="pill '+esc(o.status)+'">'+esc(o.status)+'</span>',esc(o.items),esc(o.currency)+' '+num(o.total),esc(o.buyer),esc(o.buyerPhone),esc((o.city||'')+' · '+(o.country||'')),esc(o.seller),esc(fmtDate(o.createdAt))]),9,'No orders yet');
 $('recent-users').innerHTML=rows((d.recentUsers||[]).map(u=>[esc(u.name),esc(u.email),esc(u.phone||'—'),esc(u.country),esc(fmtDate(u.createdAt)),esc(fmtDate(u.lastSeen))]),6,'No users yet');
 $('recent-products').innerHTML=rows((d.recentProducts||[]).map(p=>[esc(p.title),esc(p.category),esc(p.seller),esc(p.phone||'—'),esc(p.country),esc(p.currency)+' '+num(p.price),esc(fmtDate(p.createdAt))]),7,'No products yet');
 const dv=(o)=>Object.entries(o||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
 $('daily-visits').innerHTML=rows(dv(d.dailyVisits).map(([a,b])=>[esc(a),num(b)]),2,'Nothing yet');
 $('daily-orders').innerHTML=rows(dv(d.dailyOrders).map(([a,b])=>[esc(a),num(b)]),2,'Nothing yet');
 clearTimeout(timer);timer=setTimeout(()=>loadStats().catch(()=>{}),30000);
}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();$('login-error').textContent='';$('login-btn').disabled=true;
 try{const r=await fetch('/shop/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','x-sgm':'1'},credentials:'same-origin',body:JSON.stringify({password:$('password').value})});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Login failed');$('password').value='';await loadStats()}catch(e){$('login-error').textContent=e.message}finally{$('login-btn').disabled=false}});
$('logout').addEventListener('click',async()=>{clearTimeout(timer);await fetch('/shop/api/admin/logout',{method:'POST',headers:{'x-sgm':'1'},credentials:'same-origin'});$('dashboard').classList.add('hidden');$('login-panel').classList.remove('hidden')});
$('refresh').addEventListener('click',()=>loadStats().catch(e=>$('load-error').textContent=e.message));
loadStats().catch(e=>{$('load-error').textContent=e.message});
