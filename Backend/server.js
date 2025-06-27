const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

// Import routes
const authRoutes = require("./routes/auth")
const amazonRoutes = require("./routes/amazon")

// Initialize express app
const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/amazon", amazonRoutes)

// Amazon OAuth callback route
app.get("/amazon/callback", async (req, res) => {
  const { code, state } = req.query

  if (!code || !state) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=Invalid callback parameters`)
  }

  try {
    // Redirect to frontend with the authorization code
    // The frontend will handle this by making a request to the backend
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?code=${code}&state=${state}`)
  } catch (error) {
    console.error("Amazon callback error:", error)
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=Authentication failed`)
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Something went wrong!" })
})

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
