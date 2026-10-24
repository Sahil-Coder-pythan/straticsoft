/**
 * Phone OTP adapter.
 * Set OTP_API_KEY + OTP_PROVIDER (e.g. msg91, twilio) for real SMS.
 * Until configured, returns { configured: false } so callers can fall back to email.
 */
async function sendOtp(phone, code) {
  if (!process.env.OTP_API_KEY || process.env.OTP_PROVIDER === 'none') {
    return {
      configured: false,
      message: 'Phone verification provider is not configured. Do not treat this number as verified via SMS.',
    };
  }
  // Implement and test the selected OTP provider adapter before production use.
  // Example shape: call provider API with phone + code, return { ok: true }.
  throw new Error('Implement and test the selected OTP provider adapter before production use.');
}
module.exports = { sendOtp };
