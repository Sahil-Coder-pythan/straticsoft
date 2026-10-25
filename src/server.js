require('dotenv').config();
const { app } = require('./app');
const store = require('./services/shop-store');
const port = Number(process.env.PORT || 3000);
const start = () => app.listen(port, '0.0.0.0', () => {
  console.log(`Stratic Global Market listening on port ${port}`);
});
// Restore accounts from the database first (max 15s), then start serving.
Promise.race([store.ready(), new Promise((r) => setTimeout(r, 15000))]).catch(() => {}).then(start);
