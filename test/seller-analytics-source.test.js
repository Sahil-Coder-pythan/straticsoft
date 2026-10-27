const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('seller shop analytics declares 51 unique reports and the three requested selectable periods', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/shop.js'), 'utf8');
  const start = source.indexOf('const metricDefs = [');
  const end = source.indexOf('\n    ];', start);
  assert.ok(start >= 0 && end > start, 'analytics report definitions must exist');
  const block = source.slice(start, end);
  const ids = [...block.matchAll(/\{ id:'([^']+)'/g)].map((m) => m[1]);
  assert.equal(ids.length, 51);
  assert.equal(new Set(ids).size, 51, 'report IDs must be unique');
  const periodsBlock = source.slice(source.indexOf('const periods = ['), source.indexOf('const allProducts'));
  const periods = [...periodsBlock.matchAll(/key: '(24h|7d|30d)'/g)].map((m) => m[1]);
  assert.deepEqual(periods, ['24h', '7d', '30d']);
  assert.match(source, /51 unique reports/);
  assert.match(source, /data-period-template/);
  assert.match(source, /data-analytics-period/);
});
