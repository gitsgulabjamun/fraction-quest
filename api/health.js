// Tells the game whether it is running on the family server, and what is configured. Reveals no data.
const { storageConfigured } = require('../lib/store');
const { send } = require('../lib/http');

module.exports = (req, res) => send(res, 200, {
  ok: true,
  storage: storageConfigured(),
  familyCode: !!process.env.FAMILY_CODE,
  email: !!(process.env.RESEND_API_KEY && process.env.REPORT_EMAIL),
  telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
});
