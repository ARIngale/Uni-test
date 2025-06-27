const nodemailer = require("nodemailer")

// Create a transporter object
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

// Function to send OTP email
const sendOTPEmail = async (email, name, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4f46e5;">Email Verification</h2>
          <p>Hello ${name},</p>
          <p>Thank you for registering with UNIBAZAR. Please use the following OTP to verify your email address:</p>
          <div style="background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes.</p>
          <p>If you did not request this verification, please ignore this email.</p>
          <p>Best regards,<br>UNIBAZAR Team</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`OTP email sent to ${email}`)
  } catch (error) {
    console.error("Error sending OTP email:", error)
    throw new Error("Failed to send OTP email")
  }
}

module.exports = {
  sendOTPEmail,
}
