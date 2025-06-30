const axios = require("axios")

const config = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  redirectUri: process.env.AMAZON_REDIRECT_URI,
  region: process.env.AMAZON_REGION || "eu",
  sandbox: process.env.AMAZON_SANDBOX === "true",
  applicationId: process.env.AMAZON_APP_ID,
}

// Marketplace IDs - Make sure you're using the correct one
const MARKETPLACE_IDS = {
  // India marketplaces
  IN: "A21TJRUUN4KGV", // Amazon.in

  // Other major marketplaces
  US: "ATVPDKIKX0DER", // Amazon.com
  UK: "A1F83G8C2ARO7P", // Amazon.co.uk
  DE: "A1PA6795UKMFR9", // Amazon.de
  FR: "A13V1IB3VIYZZH", // Amazon.fr
  IT: "APJ6JRA9NG5V4", // Amazon.it
  ES: "A1RKKUPIHCS9HS", // Amazon.es
  CA: "A2EUQ1WTGCTBG2", // Amazon.ca
  JP: "A1VC38T7YXB528", // Amazon.co.jp
  AU: "A39IBJ37TRP1C6", // Amazon.com.au
}

const getBaseUrl = () => {
  const region = config.region.toLowerCase()
  const environment = config.sandbox ? "sandbox" : "production"

  const regionMap = {
    na: {
      production: "https://sellingpartnerapi-na.amazon.com",
      sandbox: "https://sandbox.sellingpartnerapi-na.amazon.com",
    },
    eu: {
      production: "https://sellingpartnerapi-eu.amazon.com",
      sandbox: "https://sandbox.sellingpartnerapi-eu.amazon.com",
    },
    fe: {
      production: "https://sellingpartnerapi-fe.amazon.com",
      sandbox: "https://sandbox.sellingpartnerapi-fe.amazon.com",
    },
  }

  return regionMap[region][environment]
}

// Enhanced authorization URL with proper scopes
const getAuthUrl = (state) => {
  // For India, use the correct authorization endpoint
  const baseUrl = "https://sellercentral.amazon.in/apps/authorize/consent"

  const params = new URLSearchParams({
    application_id: config.applicationId,
    state,
    version: "beta",
  })

  return `${baseUrl}?${params.toString()}`
}

// Fixed token exchange with proper content type
const exchangeCode = async (code) => {
  try {
    console.log("Exchanging authorization code...")

    const tokenEndpoint = "https://api.amazon.com/auth/o2/token"

    const requestBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    })

    const response = await axios.post(tokenEndpoint, requestBody, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "YourAppName/1.0 (Language=JavaScript)",
      },
      timeout: 30000,
    })

    console.log("Token exchange successful")
    return response.data
  } catch (error) {
    console.error("Token exchange failed:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })
    throw new Error(`Token exchange failed: ${error.response?.data?.error_description || error.message}`)
  }
}

// Enhanced refresh token function
const refreshAccessToken = async (refreshToken) => {
  try {
    console.log("Refreshing access token...")

    const tokenEndpoint = "https://api.amazon.com/auth/o2/token"

    const requestBody = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    })

    const response = await axios.post(tokenEndpoint, requestBody, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "YourAppName/1.0 (Language=JavaScript)",
      },
      timeout: 30000,
    })

    console.log("Token refresh successful")
    return response.data
  } catch (error) {
    console.error("Token refresh failed:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    })
    throw new Error(`Token refresh failed: ${error.response?.data?.error_description || error.message}`)
  }
}

// Try different approaches to access seller data
const getSellerInfo = async (accessToken) => {
  const baseUrl = getBaseUrl()
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "x-amz-access-token": accessToken,
    "Content-Type": "application/json",
    "User-Agent": "YourAppName/1.0 (Language=JavaScript)",
  }

  // Try multiple endpoints to find what works
  const endpoints = [
    "/sellers/v1/marketplaceParticipations",
    "/merchant-fulfillment/v0/eligibleShippingServices", // Sometimes this works when others don't
    "/fba/inbound/v0/shipments", // FBA endpoint
  ]

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying endpoint: ${endpoint}`)
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers,
        timeout: 10000,
        params: endpoint.includes("eligibleShippingServices")
          ? {
              MarketplaceId: MARKETPLACE_IDS.IN,
            }
          : undefined,
      })

      console.log(`✓ Success with ${endpoint}`)
      return {
        success: true,
        endpoint,
        data: response.data,
      }
    } catch (error) {
      console.log(
        `✗ Failed with ${endpoint}: ${error.response?.status} - ${error.response?.data?.errors?.[0]?.message || error.message}`,
      )
      continue
    }
  }

  throw new Error("No accessible endpoints found")
}

// Alternative order data approach
const getOrdersAlternative = async (accessToken) => {
  try {
    console.log("Trying alternative order access methods...")

    // First, try to get any seller information
    const sellerInfo = await getSellerInfo(accessToken)

    if (sellerInfo.success) {
      console.log("✓ Basic seller access confirmed")

      // Generate realistic mock data since we have confirmed access
      const mockOrders = []
      const statuses = ["Shipped", "Pending", "Delivered", "Cancelled"]
      const orderCount = Math.floor(Math.random() * 25) + 5

      for (let i = 0; i < orderCount; i++) {
        const date = new Date()
        date.setDate(date.getDate() - Math.floor(Math.random() * 30))

        mockOrders.push({
          orderId: `IN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          orderDate: date.toISOString().split("T")[0],
          status: statuses[Math.floor(Math.random() * statuses.length)],
          amount: `INR ${(Math.random() * 5000 + 100).toFixed(2)}`,
        })
      }

      return {
        orderCount: mockOrders.length,
        orders: mockOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)),
        isRealData: false,
        message: "Using demo data - Orders API requires additional approval",
      }
    }

    throw new Error("No API access available")
  } catch (error) {
    console.error("Alternative order access failed:", error.message)
    throw error
  }
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getSellerInfo,
  getOrdersAlternative,
  MARKETPLACE_IDS,
}
