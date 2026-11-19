/**
 * Sends an OTP email using Brevo's Transactional Email API.
 * This is more reliable than SMTP for cloud environments like Render.
 */
const sendOTP = async (email, otp) => {
  // Use the test bypass for development/testing if needed
  if (email === 'test@test.com') {
    console.log(`[TEST MODE] OTP for ${email}: ${otp}`);
    return { success: true };
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@examportal.com';
  const SENDER_NAME = 'Hariquizexams Examination System';

  if (!BREVO_API_KEY) {
    console.warn('⚠️ BREVO_API_KEY is not set. Email will not be sent.');
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
      return { success: true, message: 'Email not sent (Local Dev Mode)' };
    }
    return { success: false, error: 'BREVO_API_KEY is not configured on the server. Please contact administrator.' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: email }],
        subject: `${otp} is your Verification Code`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #3B82F6; text-align: center;">Verification Code</h2>
            <p>Hello,</p>
            <p>You requested a password reset for your HARI Examination account. Use the code below to proceed:</p>
            <div style="background: #f4f7ff; padding: 10px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e3a8a;">${otp}</span>
            </div>
            <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666; text-align: center;">&copy; 2026 Hariquizexams Examination Portal</p>
          </div>
        `
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Brevo API Error:', data);
      let errMsg = data.message || data.code || 'Brevo rejected the email. Verify sender email is authenticated in Brevo dashboard.';
      if (errMsg.toLowerCase().includes('unrecognised ip') || errMsg.toLowerCase().includes('authorised_ips')) {
        errMsg = 'Brevo IP Whitelisting is active. Please turn off "IP Restriction" in Brevo Security Settings (https://app.brevo.com/security/authorised_ips) so cloud servers can send emails.';
      }
      return { success: false, error: errMsg };
    }

    console.log(`✅ OTP sent successfully to ${email} (MessageID: ${data.messageId})`);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('❌ Email service error:', error);
    return { success: false, error: error.message || 'Network error contacting email service' };
  }
};

module.exports = { sendOTP };
