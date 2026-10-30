require('dotenv').config();
const { app } = require('./app');
const store = require('./services/shop-store');
const chat = require('./services/chat-store');
const port = Number(process.env.PORT || 3000);
const start = () => app.listen(port, '0.0.0.0', () => {
  console.log(`Stratic Global Market listening on port ${port}`);
});
// Never start serving while database restore is still running: a late restore can
// otherwise overwrite fresh local writes. Chat storage must also finish restoring before
// routes become available; otherwise image requests can race startup and use temporary files.
Promise.all([store.ready(), chat.ready]).then(start).catch((err) => {
  console.error('Startup blocked to protect marketplace data:', err.message);
  process.exitCode = 1;
  if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') process.exit(1);
});
