const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('public shop analytics menu is hidden by default and opens on tap', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/shop.js'), 'utf8');
  const route = source.slice(source.indexOf("router.get('/s/:slug'"), source.indexOf("router.get('/api/product-dashboard'"));
  assert.match(route, /\.lux-chart-menu\{display:none!important/);
  assert.match(route, /\.lux-chart-menu\.open\{display:grid!important/);
  assert.match(route, /t\.addEventListener\("click",function\(e\)\{e\.stopPropagation\(\)/);
  assert.match(route, /m\.classList\.toggle\("open"\)/);
  assert.match(route, /data-period="24h"/);
  assert.match(route, /data-period="7d"/);
  assert.match(route, /data-period="30d"/);
});
