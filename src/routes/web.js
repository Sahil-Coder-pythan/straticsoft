const express = require('express');
const { supportedLanguages } = require('../i18n');
const router = express.Router();
router.get('/', (req, res) => res.render('home', { title: 'Stratic Global Market' }));
router.get('/book-parcel', (req, res) => res.render('booking', { title: 'Book a parcel' }));
router.get('/language-test', (req, res) => res.render('language-test', { title: 'Global Language Parcel Test' }));
router.get('/track', (req, res) => res.render('track', { title: 'Track a booking' }));
router.get('/help', (req, res) => res.render('help', { title: 'Help & safety' }));
router.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy' }));
router.get('/terms', (req, res) => res.render('terms', { title: 'Terms' }));
router.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.status(200).json({ status: 'ok', service: 'stratic-global-market', timestamp: new Date().toISOString() });
});
router.get('/languages', (req, res) => res.json({ languages: supportedLanguages }));
module.exports = router;
