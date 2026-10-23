const express = require('express');
const { bookingLimiter } = require('../middleware/rate-limit');
const { createBookingSchema, trackingSchema } = require('../validation/booking');
const { createBooking, findBooking } = require('../services/booking-service');
const { getAssistantReply } = require('../services/ai-service');
const { getCarrierStatus } = require('../services/carrier-service');
const router = express.Router();
router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.post('/bookings', bookingLimiter, async (req, res, next) => {
  try {
    const input = createBookingSchema.parse(req.body);
    const booking = await createBooking(input);
    res.status(201).json({ booking, notice: 'Request saved. This is not a carrier-confirmed booking until a shipping provider confirms it.' });
  } catch (err) { next(err); }
});
router.get('/bookings/:publicRef', async (req, res, next) => {
  try {
    const parsed = trackingSchema.parse({ publicRef: req.params.publicRef, phone: req.query.phone });
    const booking = await findBooking(parsed.publicRef, parsed.phone);
    if (!booking) return res.status(404).json({ error: 'No booking found for that reference and phone.' });
    const carrier = await getCarrierStatus(booking);
    res.json({ booking, carrier });
  } catch (err) { next(err); }
});
router.post('/assistant', async (req, res, next) => {
  try {
    const question = String(req.body.question || '').slice(0, 2000);
    if (!question.trim()) return res.status(400).json({ error: 'Enter a question.' });
    res.json(await getAssistantReply(question, req.body.language || 'en'));
  } catch (err) { next(err); }
});
module.exports = router;
