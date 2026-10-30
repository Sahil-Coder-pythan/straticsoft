(function () {
  // Public shop page: open the WhatsApp APP (not the website) when the app is installed.
  var links = document.querySelectorAll('a[data-wa]');
  Array.prototype.forEach.call(links, function (a) {
    a.addEventListener('click', function (e) {
      var num = a.getAttribute('data-wa'), msg = a.getAttribute('data-msg') || '';
      var q = encodeURIComponent(msg), web = 'https://wa.me/' + num + '?text=' + q;
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return; // normal link opens the app on iPhone
      e.preventDefault();
      var left = false; function onv() { if (document.hidden) left = true; }
      document.addEventListener('visibilitychange', onv);
      window.location.href = 'whatsapp://send?phone=' + num + '&text=' + q;
      setTimeout(function () { document.removeEventListener('visibilitychange', onv); if (!left && !document.hidden) window.open(web, '_blank'); }, 1800);
    });
  });
})();

(function () {
  // Owner's advanced dashboard on the public shop page (data is only sent to the signed-in owner)
  var g = document.getElementById('adv-grid'), dj = document.getElementById('adv-data'); if (!g || !dj) return;
  var d; try { d = JSON.parse(dj.textContent); } catch (e) { return; }
  var L = { '24h': 'Last 24 hours', '7d': 'Last 7 days', '30d': 'Last 30 days' }, cur = {}, n = d['24h'].length;
  function mk(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function draw() {
    g.textContent = '';
    for (var i = 0; i < n; i++) (function (i) {
      var r = cur[i] || '24h', c = d[r][i], card = mk('div', 'ac' + (c.type === 'list' ? ' wide' : '')), h = mk('div', 'ach');
      var dots = mk('button', 'acd', '⋯'), menu = mk('div', 'acm'); dots.type = 'button'; menu.hidden = true;
      h.append(mk('span', '', c.icon), mk('b', '', c.title), dots, menu);
      ['24h', '7d', '30d'].forEach(function (k) { var b = mk('button', k === r ? 'on' : '', L[k]); b.type = 'button'; b.onclick = function () { cur[i] = k; draw(); }; menu.appendChild(b); });
      dots.onclick = function (e) { e.stopPropagation(); var was = menu.hidden; g.querySelectorAll('.acm').forEach(function (m) { m.hidden = true; }); menu.hidden = !was; };
      card.appendChild(h);
      if (c.type === 'num') card.appendChild(mk('div', 'acb', c.value));
      else { var mx = 1; c.rows.forEach(function (q) { if (q.value > mx) mx = q.value; }); if (!c.rows.length) card.appendChild(mk('div', 'acn', 'No data yet')); c.rows.forEach(function (q) { var row = mk('div', 'acr'); row.append(mk('span', '', q.label), mk('b', '', String(q.value))); var bar = mk('i'); bar.style.width = Math.max(4, Math.round(q.value / mx * 100)) + '%'; row.appendChild(bar); card.appendChild(row); }); }
      card.appendChild(mk('small', 'acg', L[r])); g.appendChild(card);
    })(i);
  }
  draw(); document.addEventListener('click', function () { g.querySelectorAll('.acm').forEach(function (m) { m.hidden = true; }); });
})();
