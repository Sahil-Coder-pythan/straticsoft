async function sendJson(url, data) {
 const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload.error||'Request failed'); return payload;
}
const bookingForm=document.querySelector('#booking-form');
if(bookingForm) bookingForm.addEventListener('submit',async event=>{event.preventDefault();const out=document.querySelector('#booking-result');const data=Object.fromEntries(new FormData(bookingForm).entries());try{const r=await sendJson('/api/bookings',data);out.textContent=`Request saved: ${r.booking.publicRef}\nStatus: ${r.booking.status}\n${r.notice}`;bookingForm.reset();}catch(e){out.textContent=e.message;}});
const trackForm=document.querySelector('#track-form');
if(trackForm) trackForm.addEventListener('submit',async event=>{event.preventDefault();const out=document.querySelector('#track-result');const d=new FormData(trackForm);out.textContent='Searching…';try{const response=await fetch(`/api/bookings/${encodeURIComponent(d.get('publicRef'))}?phone=${encodeURIComponent(d.get('phone'))}`);const r=await response.json();if(!response.ok)throw new Error(r.error||'Not found');out.textContent=`Reference: ${r.booking.publicRef}\nStatus: ${r.booking.status}\nCarrier: ${r.carrier.message}\n${r.booking.events.map(e=>`${e.status} — ${e.note}`).join('\n')}`;}catch(e){out.textContent=e.message;}});
const assistantForm=document.querySelector('#assistant-form');
if(assistantForm) assistantForm.addEventListener('submit',async event=>{event.preventDefault();const out=document.querySelector('#assistant-answer');out.textContent='Thinking…';try{const r=await sendJson('/api/assistant',{question:document.querySelector('#question').value,language:document.documentElement.lang});out.textContent=r.reply;}catch(e){out.textContent=e.message;}});
