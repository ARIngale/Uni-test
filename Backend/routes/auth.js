const express = require("express")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const { sendOTPEmail } = require("../utils/email")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Register a new user
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
    })

    // Generate OTP
    const otp = user.generateOTP()

    // Save user to database
    await user.save()

    // Send OTP email
    await sendOTPEmail(email, name, otp)

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" })

    // Return user data and token
    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
      token,
    })
  } catch (error) {
    console.error("Signup error:", error)
    res.status(500).json({ message: "Server error during registration" })
  }
})

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    // Find user by email
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" })

    // Return user data and token
    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error during login" })
  }
})

// Verify OTP
router.post("/verify-otp", authenticateToken, async (req, res) => {
  try {
    const { email, otp } = req.body

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" })
    }

    // Find user by email
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Verify OTP
    if (!user.verifyOTP(otp)) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    // Mark user as verified
    user.isVerified = true
    user.otp = undefined // Clear OTP after successful verification
    await user.save()

    res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    })
  } catch (error) {
    console.error("OTP verification error:", error)
    res.status(500).json({ message: "Server error during OTP verification" })
  }
})

// Resend OTP
router.post("/resend-otp", authenticateToken, async (req, res) => {
  try {
    const { email } = req.body

    // Validate input
    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    // Find user by email
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified" })
    }

    // Generate new OTP
    const otp = user.generateOTP()
    await user.save()

    // Send OTP email
    await sendOTPEmail(email, user.name, otp)

    res.status(200).json({ message: "OTP sent successfully" })
  } catch (error) {
    console.error("Resend OTP error:", error)
    res.status(500).json({ message: "Server error while resending OTP" })
  }
})

module.exports = router
