// StratisSoft data-driven tool engine. Add a tool = one F(...) call with 40 options.
// Option: [name, 'a:Label:default,b:Label:default', 'js expression using a,b,c,d', unit]
(function(){
const TOOLS=[];
function F(id,name,icon,desc,grad,opts){TOOLS.push({id,name,icon,desc,grad,opts});}
const fmt=(v,u)=>{ if(!isFinite(v)) return 'Not computable (check inputs)';
  if(u==='₹') return '₹'+Math.round(v).toLocaleString('en-IN');
  return (Math.round(v*100)/100).toLocaleString('en-IN')+(u?(' '+u):''); };

F('fiscal','Fiscal','fa-coins','Finance Control','linear-gradient(135deg,#f59e0b,#d97706)',[
['Gross Margin %','a:Revenue:1000000,b:COGS:600000','(a-b)/a*100','%'],
['Net Margin %','a:Revenue:1000000,b:Net profit:120000','b/a*100','%'],
['Operating Margin %','a:Revenue:1000000,b:COGS+Opex:850000','(a-b)/a*100','%'],
['EBITDA','a:Revenue:1000000,b:COGS:600000,c:Opex:250000','a-b-c','₹'],
['Break-even Units','a:Fixed cost:500000,b:Price/unit:500,c:Variable cost/unit:300','a/(b-c)','units'],
['Break-even Revenue','a:Fixed cost:500000,b:Margin %:40','a/(b/100)','₹'],
['Cash Runway','a:Cash in bank:2400000,b:Monthly burn:300000','a/b','months'],
['Burn Rate / month','a:Cash start:3000000,b:Cash now:2400000,c:Months:3','(a-b)/c','₹'],
['ROI %','a:Gain:150000,b:Cost:100000','(a-b)/b*100','%'],
['Payback Period','a:Investment:1200000,b:Monthly return:80000','a/b','months'],
['CAC','a:Marketing+sales spend:400000,b:New customers:80','a/b','₹'],
['Customer LTV','a:ARPU/month:2000,b:Margin %:70,c:Monthly churn %:4','a*(b/100)/(c/100)','₹'],
['LTV : CAC','a:LTV:35000,b:CAC:5000','a/b','x'],
['Current Ratio','a:Current assets:2000000,b:Current liabilities:1200000','a/b','x'],
['Quick Ratio','a:Assets excl. inventory:1500000,b:Current liabilities:1200000','a/b','x'],
['Debt-to-Equity','a:Total debt:2000000,b:Equity:3000000','a/b','x'],
['Interest Coverage','a:EBIT:900000,b:Interest:150000','a/b','x'],
['DSO (collection days)','a:Receivables:800000,b:Credit sales:6000000,c:Days:365','a/b*c','days'],
['DPO (payment days)','a:Payables:500000,b:COGS:4000000,c:Days:365','a/b*c','days'],
['Inventory Turnover','a:COGS:4000000,b:Avg inventory:600000','a/b','x'],
['DIO (stock days)','a:Avg inventory:600000,b:COGS:4000000,c:Days:365','a/b*c','days'],
['Cash Conversion Cycle','a:DSO:48,b:DIO:55,c:DPO:45','a+b-c','days'],
['Working Capital','a:Current assets:2000000,b:Current liabilities:1200000','a-b','₹'],
['GST Payable','a:Output GST:360000,b:Input credit:240000','a-b','₹'],
['GST Amount','a:Base price:10000,b:GST %:18','a*b/100','₹'],
['Price incl. GST','a:Base price:10000,b:GST %:18','a*(1+b/100)','₹'],
['Loan EMI','a:Principal:1000000,b:Annual rate %:10,c:Months:60','a*(b/1200)*(1+b/1200)**c/((1+b/1200)**c-1)','₹'],
['Total Loan Interest','a:Principal:1000000,b:Annual rate %:10,c:Months:60','a*(b/1200)*(1+b/1200)**c/((1+b/1200)**c-1)*c-a','₹'],
['Simple Interest','a:Principal:100000,b:Rate %:8,c:Years:3','a*b*c/100','₹'],
['Compound Interest','a:Principal:100000,b:Rate %:8,c:Years:3','a*((1+b/100)**c-1)','₹'],
['CAGR','a:Start value:100000,b:End value:180000,c:Years:4','((b/a)**(1/c)-1)*100','%'],
['NPV (annuity)','a:Yearly cash flow:400000,b:Discount %:12,c:Years:5,d:Initial investment:1200000','-d+a*(1-(1+b/100)**-c)/(b/100)','₹'],
['Markup %','a:Cost:600,b:Selling price:900','(b-a)/a*100','%'],
['Price for Target Margin','a:Cost:600,b:Target margin %:35','a/(1-b/100)','₹'],
['Discount Impact on Profit','a:Price:1000,b:Cost:600,c:Discount %:10','((a*(1-c/100)-b)/(a-b)-1)*100','% profit change'],
['Contribution Margin','a:Price/unit:1000,b:Variable cost/unit:600','a-b','₹'],
['Operating Leverage','a:Contribution margin:700000,b:Operating profit:250000','a/b','x'],
['Budget Variance %','a:Budget:500000,b:Actual:560000','(b-a)/a*100','%'],
['Burn Multiple','a:Net burn:3000000,b:Net new ARR:2000000','a/b','x'],
['Rule of 40 Score','a:Revenue growth %:35,b:Profit margin %:8','a+b','points']
]);

F('pulse','Pulse','fa-bullseye','Sales Growth','linear-gradient(135deg,#06b6d4,#0891b2)',[
['Lead Conversion %','a:Customers won:40,b:Leads:800','a/b*100','%'],
['Lead-to-Opportunity %','a:Opportunities:160,b:Leads:800','a/b*100','%'],
['Win Rate %','a:Deals won:40,b:Deals closed:130','a/b*100','%'],
['Avg Deal Size','a:Revenue:4000000,b:Deals:40','a/b','₹'],
['Pipeline Coverage','a:Pipeline value:12000000,b:Target:4000000','a/b','x'],
['Weighted Pipeline','a:Pipeline value:12000000,b:Win probability %:30','a*b/100','₹'],
['Quota Attainment %','a:Achieved:3200000,b:Quota:4000000','a/b*100','%'],
['Leads Needed for Target','a:Target revenue:5000000,b:Avg deal:100000,c:Lead-to-win %:5','a/b/(c/100)','leads'],
['Deals Needed','a:Target revenue:5000000,b:Avg deal:100000','a/b','deals'],
['Sales Velocity / day','a:Opportunities:160,b:Avg deal:100000,c:Win %:25,d:Cycle days:45','a*b*(c/100)/d','₹'],
['Customer Churn %','a:Customers lost:12,b:Customers at start:300','a/b*100','%'],
['Retention %','a:Customers lost:12,b:Customers at start:300','100-a/b*100','%'],
['MRR','a:Customers:300,b:ARPU:2500','a*b','₹'],
['ARR','a:MRR:750000','a*12','₹'],
['Net Revenue Retention %','a:Start MRR:750000,b:Expansion:60000,c:Churned MRR:40000','(a+b-c)/a*100','%'],
['Customer Growth %','a:New customers:30,b:Customers at start:300','a/b*100','%'],
['MoM Growth %','a:Previous month:700000,b:This month:770000','(b-a)/a*100','%'],
['Revenue per Employee','a:Revenue:50000000,b:Employees:40','a/b','₹'],
['Cost per Lead','a:Spend:200000,b:Leads:800','a/b','₹'],
['Cost per Acquisition','a:Spend:200000,b:Conversions:40','a/b','₹'],
['ROAS','a:Revenue from ads:1200000,b:Ad spend:300000','a/b','x'],
['CTR %','a:Clicks:2400,b:Impressions:100000','a/b*100','%'],
['Email Open Rate %','a:Opens:4200,b:Delivered:15000','a/b*100','%'],
['Cart Abandonment %','a:Abandoned carts:700,b:Carts created:1000','a/b*100','%'],
['Repeat Purchase %','a:Repeat customers:240,b:Total customers:800','a/b*100','%'],
['Avg Order Value','a:Revenue:2400000,b:Orders:3000','a/b','₹'],
['Commission Payout','a:Sales:2000000,b:Commission %:3','a*b/100','₹'],
['Upsell Revenue','a:Customers:300,b:Upsell take %:15,c:Upsell value:5000','a*b/100*c','₹'],
['Referral Revenue','a:Referrals:50,b:Conversion %:30,c:Deal value:100000','a*b/100*c','₹'],
['Yearly Loss from Churn','a:MRR:750000,b:Monthly churn %:4','a*b/100*12','₹'],
['CAC Recovery Time','a:CAC:5000,b:ARPU/month:2500,c:Margin %:70','a/(b*c/100)','months'],
['Sales Reps Needed','a:Target:20000000,b:Quota per rep:4000000,c:Avg attainment %:80','a/(b*c/100)','reps'],
['Gain from Faster Lead Response','a:Leads/month:800,b:Conversion uplift %:3,c:Deal value:100000','a*b/100*c','₹'],
['Sales Efficiency','a:Net new ARR:6000000,b:Sales & marketing spend:4000000','a/b','x'],
['SaaS Magic Number','a:Annualised revenue change:5000000,b:Prev. S&M spend:4000000','a/b','x'],
['Next Month Forecast','a:This month:770000,b:Growth %:8','a*(1+b/100)','₹'],
['12-Month Forecast','a:This month:770000,b:Monthly growth %:5','a*(1+b/100)**12','₹'],
['Market Share %','a:Your revenue:50000000,b:Market size:1000000000','a/b*100','%'],
['Customer Concentration %','a:Top customer revenue:12000000,b:Total revenue:50000000','a/b*100','%'],
['NPS','a:Promoters %:55,b:Detractors %:15','a-b','points']
]);

const grid=document.querySelector('.apps-grid'), now=()=>new Date().toISOString().slice(0,10);
TOOLS.forEach(t=>{
  const card=document.createElement('div'); card.className='app-card'; card.onclick=()=>open(t);
  card.innerHTML=`<div class="app-icon" style="background:${t.grad}"><i class="fas ${t.icon}"></i></div><div class="app-name">${t.name}</div><div class="app-desc">${t.desc}</div>`;
  grid.appendChild(card);
});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function open(t){
  const k='x_'+t.id; let v=document.getElementById('tool-'+k);
  if(!v){ v=document.createElement('div'); v.className='tool-view'; v.id='tool-'+k;
    v.innerHTML=`<div class="tool-top"><button class="back-btn" onclick="closeTool()"><i class="fas fa-arrow-left"></i> Suite</button><strong>${t.name}</strong><span style="color:#64748b;font-size:13px">${t.desc}</span></div><div class="tool-body-wrap"><div class="tool-sidebar"></div><div class="tool-main"></div></div>`;
    document.body.appendChild(v);
    const sb=v.querySelector('.tool-sidebar');
    sb.innerHTML='<div class="opt active" data-i="-1"><i class="fas fa-chart-pie"></i> Dashboard</div><div class="sec">'+t.opts.length+' options</div>'+t.opts.map((o,i)=>`<div class="opt" data-i="${i}"><i class="fas fa-calculator"></i> ${esc(o[0])}</div>`).join('');
    sb.onclick=e=>{const o=e.target.closest('.opt'); if(!o) return; sb.querySelectorAll('.opt').forEach(x=>x.classList.remove('active')); o.classList.add('active'); show(t,v.querySelector('.tool-main'),+o.dataset.i);};
  }
  document.getElementById('suiteApp').style.display='none';
  document.querySelectorAll('.tool-view').forEach(e=>e.classList.remove('active')); v.classList.add('active');
  show(t,v.querySelector('.tool-main'),-1);
}
let chart;
function show(t,el,i){
  const k='x_'+t.id, h=Store.get(k,'history',[]);
  if(i<0){
    const days=[...Array(7)].map((_,n)=>new Date(Date.now()-(6-n)*864e5).toISOString().slice(0,10));
    const used=new Set(h.map(x=>x.title)).size;
    el.innerHTML=`<h2 style="margin-bottom:20px">${t.name} Dashboard</h2><div class="dash-grid"><div class="dash-card"><div class="label">Total Runs</div><div class="value">${h.length}</div></div><div class="dash-card"><div class="label">Today</div><div class="value">${h.filter(x=>x.ts.slice(0,10)===now()).length}</div></div><div class="dash-card"><div class="label">Options Used</div><div class="value">${used}/${t.opts.length}</div></div></div><div class="panel"><h3>Last 7 days</h3><canvas id="ch" height="90"></canvas></div><div class="panel"><h3>History (private, never auto-deleted)</h3>${h.length?h.slice(0,50).map(x=>`<div class="hist-item"><strong>${esc(x.title)}</strong><div class="time">${new Date(x.ts).toLocaleString()} — ${esc(x.detail)}</div></div>`).join(''):'<p style="color:#64748b">No history yet.</p>'}<p style="margin-top:12px"><button onclick="downloadJSON('${k}')" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#e2e8f0;cursor:pointer">Export history</button></p></div>`;
    if(chart) chart.destroy();
    chart=new Chart(el.querySelector('#ch'),{type:'bar',data:{labels:days.map(d=>d.slice(5)),datasets:[{data:days.map(d=>h.filter(x=>x.ts.slice(0,10)===d).length),backgroundColor:'#6366f1'}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
    return;
  }
  const [name,spec,expr,unit]=t.opts[i], f=spec.split(',').map(s=>s.split(':'));
  el.innerHTML=`<h2>${esc(name)}</h2><div class="panel">${f.map(([n,l,d])=>`<div class="form-group"><label>${esc(l)}</label><input type="number" step="any" data-n="${n}" value="${d||''}"></div>`).join('')}<button id="go" style="padding:10px 18px;border-radius:8px;border:none;background:#6366f1;color:#fff;cursor:pointer">Calculate</button><div id="res" style="margin-top:16px;font-size:18px"></div></div>`;
  el.querySelector('#go').onclick=()=>{
    const a={a:0,b:0,c:0,d:0}; el.querySelectorAll('input').forEach(x=>a[x.dataset.n]=parseFloat(x.value));
    const r=new Function('a','b','c','d','return '+expr)(a.a,a.b,a.c,a.d), out=fmt(r,unit);
    el.querySelector('#res').innerHTML='Result: <strong>'+out+'</strong>';
    if(isFinite(r)) Store.addHistory(k,{title:name,detail:out});
  };
}
})();
