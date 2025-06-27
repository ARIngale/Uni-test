const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    code: String,
    expiresAt: Date,
  },
  amazonAuth: {
    accessToken: String,
    refreshToken: String,
    tokenExpiresAt: Date,
    sellerId: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Method to generate OTP
userSchema.methods.generateOTP = function () {
  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()

  // Set OTP expiry to 10 minutes from now
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + 10)

  this.otp = {
    code: otp,
    expiresAt,
  }

  return otp
}

// Method to verify OTP
userSchema.methods.verifyOTP = function (otpToVerify) {
  if (!this.otp || !this.otp.code || !this.otp.expiresAt) {
    return false
  }

  if (new Date() > this.otp.expiresAt) {
    return false // OTP expired
  }

  return this.otp.code === otpToVerify
}

const User = mongoose.model("User", userSchema)

module.exports = User
