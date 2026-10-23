const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { generalLimiter } = require('./middleware/rate-limit');
const { errorHandler, notFound } = require('./middleware/errors');
const { attachLanguage } = require('./middleware/language');
const webRoutes = require('./routes/web');
const apiRoutes = require('./routes/api');
const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:'], mediaSrc: ["'self'"],
  connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"]
}}}));
app.use(compression());
app.use(cors({ origin: process.env.APP_URL || false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(generalLimiter);
app.use(attachLanguage);
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);
module.exports = { app };
