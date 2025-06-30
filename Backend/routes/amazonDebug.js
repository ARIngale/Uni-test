const express = require("express")
const { authenticateToken } = require("../middleware/auth")
const User = require("../models/User")
const { generateTroubleshootingReport, testApiConnectivity } = require("../services/amazonSpApiDebug")
const { refreshAccessToken } = require("../services/amazonSpApi")

const router = express.Router()

// Debug endpoint to run comprehensive troubleshooting
router.get("/debug", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await User.findById(userId)

    if (!user || !user.amazonAuth || !user.amazonAuth.accessToken) {
      return res.status(400).json({
        message: "Amazon account not connected",
        recommendation: "Please connect your Amazon account first",
      })
    }

    // Ensure token is fresh
    let accessToken = user.amazonAuth.accessToken
    const now = new Date()
    const expiryTime = new Date(user.amazonAuth.tokenExpiresAt)

    if (now.getTime() > expiryTime.getTime() - 5 * 60 * 1000) {
      console.log("Refreshing token for debug...")
      const tokenData = await refreshAccessToken(user.amazonAuth.refreshToken)
      accessToken = tokenData.access_token

      user.amazonAuth.accessToken = accessToken
      user.amazonAuth.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
      await user.save()
    }

    // Run comprehensive troubleshooting
    console.log(`Running debug for user ${userId}...`)
    await generateTroubleshootingReport(accessToken)

    res.json({
      message: "Debug report generated. Check server logs for detailed information.",
      userId,
      sellerId: user.amazonAuth.sellerId,
      tokenExpiry: user.amazonAuth.tokenExpiresAt,
      recommendation: "Check server console for detailed troubleshooting report",
    })
  } catch (error) {
    console.error("Debug endpoint error:", error)
    res.status(500).json({
      message: "Debug failed",
      error: error.message,
    })
  }
})

// Quick connectivity test
router.get("/test-connection", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await User.findById(userId)

    if (!user || !user.amazonAuth || !user.amazonAuth.accessToken) {
      return res.status(400).json({
        message: "Amazon account not connected",
      })
    }

    await testApiConnectivity(user.amazonAuth.accessToken)

    res.json({
      message: "Connection test completed. Check server logs for results.",
    })
  } catch (error) {
    console.error("Connection test error:", error)
    res.status(500).json({
      message: "Connection test failed",
      error: error.message,
    })
  }
})

module.exports = router
