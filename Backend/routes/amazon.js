const express = require("express")
const { authenticateToken } = require("../middleware/auth")
const User = require("../models/User")
const { getAuthUrl, exchangeCode, refreshAccessToken, getOrderCount,getRecentOrders } = require("../services/amazonSpApi")

const router = express.Router()

// Get Amazon authorization URL
router.get("/auth-url", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    // Generate a state parameter to prevent CSRF attacks
    // The state should include the user ID so we can identify the user when Amazon redirects back
    const state = Buffer.from(JSON.stringify({ userId })).toString("base64")

    // Get the authorization URL from the Amazon SP API service
    const authUrl = getAuthUrl(state)

    res.json({ authUrl })
  } catch (error) {
    console.error("Error generating Amazon auth URL:", error)
    res.status(500).json({ message: "Failed to generate Amazon authorization URL" })
  }
})

// Handle Amazon OAuth callback
router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code || req.query.spapi_oauth_code
    const state = req.query.state

    if (!code || !state) {
      return res.status(400).json({ message: "Missing required parameters" })
    }

    // Decode the state parameter to get the user ID
    const decodedState = JSON.parse(Buffer.from(state, "base64").toString())
    const userId = decodedState.userId

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
      sellerId: tokenData.seller_id,
    }

    await user.save()

    res.json({ message: "Amazon account connected successfully" })
  } catch (error) {
    console.error("Error handling Amazon callback:", error)
    res.status(500).json({ message: "Failed to connect Amazon account" })
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

    // If connected, also return the order count if available
    let orderCount
    if (isConnected) {
      // Check if the access token is expired
      const isTokenExpired = new Date() > user.amazonAuth.tokenExpiresAt

      if (isTokenExpired) {
        // Refresh the access token
        const tokenData = await refreshAccessToken(user.amazonAuth.refreshToken)

        // Update the tokens in the user document
        user.amazonAuth.accessToken = tokenData.access_token
        user.amazonAuth.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
        await user.save()
      }

      try {
        // Get the order count
        orderCount = await getOrderCount(user.amazonAuth.accessToken, user.amazonAuth.sellerId)
      } catch (error) {
        console.error("Error getting order count:", error)
        // Don't fail the request if we can't get the order count
      }
    }

    res.json({
      connected: isConnected,
      orderCount,
    })
  } catch (error) {
    console.error("Error checking Amazon connection status:", error)
    res.status(500).json({ message: "Failed to check Amazon connection status" })
  }
})

// Get order count
router.get("/orders", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId

    // Find the user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if the user has connected their Amazon account
    if (!user.amazonAuth || !user.amazonAuth.accessToken) {
      return res.status(400).json({ message: "Amazon account not connected" })
    }

    // Check if the access token is expired
    const isTokenExpired = new Date() > user.amazonAuth.tokenExpiresAt

    if (isTokenExpired) {
      // Refresh the access token
      const tokenData = await refreshAccessToken(user.amazonAuth.refreshToken)

      // Update the tokens in the user document
      user.amazonAuth.accessToken = tokenData.access_token
      user.amazonAuth.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
      await user.save()
    }

    // Get the order count
    const orderCount = await getOrderCount(user.amazonAuth.accessToken, user.amazonAuth.sellerId)
    const orders = await getRecentOrders(user.amazonAuth.accessToken, user.amazonAuth.sellerId) 

    res.json({ orderCount, orders})
  } catch (error) {
    console.error("Error getting order count:", error)
    res.status(500).json({ message: "Failed to get order count" })
  }
})

module.exports = router
