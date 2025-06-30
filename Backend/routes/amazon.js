const express = require("express")
const { authenticateToken } = require("../middleware/auth")
const User = require("../models/User")
const {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getOrderCount,
  getRecentOrders,
} = require("../services/amazonSpApi")

const router = express.Router()

// Helper function to ensure valid access token
const ensureValidAccessToken = async (user) => {
  if (!user.amazonAuth || !user.amazonAuth.accessToken) {
    throw new Error("Amazon account not connected")
  }

  // Check if the access token is expired (with 5 minute buffer)
  const now = new Date()
  const expiryTime = new Date(user.amazonAuth.tokenExpiresAt)
  const bufferTime = 5 * 60 * 1000 // 5 minutes in milliseconds

  if (now.getTime() > expiryTime.getTime() - bufferTime) {
    console.log("Access token expired or expiring soon, refreshing...")

    if (!user.amazonAuth.refreshToken) {
      throw new Error("No refresh token available. Please reconnect your Amazon account.")
    }

    // Refresh the access token
    const tokenData = await refreshAccessToken(user.amazonAuth.refreshToken)

    // Update the tokens in the user document
    user.amazonAuth.accessToken = tokenData.access_token
    user.amazonAuth.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    // Update refresh token if provided
    if (tokenData.refresh_token) {
      user.amazonAuth.refreshToken = tokenData.refresh_token
    }

    await user.save()
    console.log("Access token refreshed successfully")
  }

  return user.amazonAuth.accessToken
}

// Get Amazon authorization URL
router.get("/auth-url", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    if (!userId) {
      return res.status(400).json({ message: "User ID not found in token" })
    }

    // Generate a state parameter to prevent CSRF attacks
    const state = Buffer.from(
      JSON.stringify({
        userId,
        timestamp: Date.now(), // Add timestamp for additional security
      }),
    ).toString("base64")

    // Get the authorization URL from the Amazon SP API service
    const authUrl = getAuthUrl(state)

    res.json({ authUrl })
  } catch (error) {
    console.error("Error generating Amazon auth URL:", error)
    res.status(500).json({
      message: "Failed to generate Amazon authorization URL",
      error: error.message,
    })
  }
})

// Handle Amazon OAuth callback
router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code || req.query.spapi_oauth_code
    const state = req.query.state
    const error = req.query.error

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error, req.query.error_description)
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=oauth_failed`)
    }

    if (!code || !state) {
      console.error("Missing required parameters:", { code: !!code, state: !!state })
      return res.status(400).json({ message: "Missing required parameters" })
    }

    // Decode the state parameter to get the user ID
    let decodedState
    try {
      decodedState = JSON.parse(Buffer.from(state, "base64").toString())
    } catch (err) {
      console.error("Invalid state parameter:", err)
      return res.status(400).json({ message: "Invalid state parameter" })
    }

    const userId = decodedState.userId

    if (!userId) {
      return res.status(400).json({ message: "User ID not found in state" })
    }

    // Find the user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Exchange the authorization code for access and refresh tokens
    const tokenData = await exchangeCode(code)

    // Save the tokens to the user document
    user.amazonAuth = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      sellerId: tokenData.selling_partner_id || tokenData.seller_id,
      connectedAt: new Date(),
    }

    await user.save()

    console.log(`Amazon account connected successfully for user ${userId}`)
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?connected=true`)
  } catch (error) {
    console.error("Error handling Amazon callback:", error)
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=connection_failed`)
  }
})

// Check Amazon connection status
router.get("/status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    // Find the user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if the user has connected their Amazon account
    const isConnected = !!user.amazonAuth && !!user.amazonAuth.accessToken

    let orderCount = null
    if (isConnected) {
      try {
        // Ensure we have a valid access token
        const accessToken = await ensureValidAccessToken(user)

        // Get the order count
        orderCount = await getOrderCount(accessToken, user.amazonAuth.sellerId)
      } catch (error) {
        console.error("Error getting order count for status:", error)
        // Don't fail the request if we can't get the order count
        // This allows the UI to still show connection status
      }
    }

    res.json({
      connected: isConnected,
      orderCount,
      sellerId: user.amazonAuth?.sellerId,
      connectedAt: user.amazonAuth?.connectedAt,
    })
  } catch (error) {
    console.error("Error checking Amazon connection status:", error)
    res.status(500).json({
      message: "Failed to check Amazon connection status",
      error: error.message,
    })
  }
})

// Get order count and recent orders
router.get("/orders", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    // Find the user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Ensure we have a valid access token
    const accessToken = await ensureValidAccessToken(user)

    // Get both order count and recent orders
    const [orderCount, orders] = await Promise.all([
      getOrderCount(accessToken, user.amazonAuth.sellerId),
      getRecentOrders(accessToken, user.amazonAuth.sellerId),
    ])

    res.json({
      orderCount,
      orders,
      sellerId: user.amazonAuth.sellerId,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error getting orders:", error)

    // Provide specific error responses
    if (error.message.includes("not connected")) {
      return res.status(400).json({ message: "Amazon account not connected" })
    } else if (error.message.includes("Authentication failed")) {
      return res.status(401).json({ message: "Authentication failed. Please reconnect your Amazon account." })
    } else if (error.message.includes("Access denied")) {
      return res.status(403).json({ message: "Access denied. Please check your Amazon SP API permissions." })
    } else if (error.message.includes("Rate limit")) {
      return res.status(429).json({ message: "Rate limit exceeded. Please try again later." })
    }

    res.status(500).json({
      message: "Failed to get orders",
      error: error.message,
    })
  }
})

// Disconnect Amazon account
router.delete("/disconnect", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    // Find the user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Remove Amazon auth data
    user.amazonAuth = undefined
    await user.save()

    console.log(`Amazon account disconnected for user ${userId}`)
    res.json({ message: "Amazon account disconnected successfully" })
  } catch (error) {
    console.error("Error disconnecting Amazon account:", error)
    res.status(500).json({
      message: "Failed to disconnect Amazon account",
      error: error.message,
    })
  }
})

module.exports = router
