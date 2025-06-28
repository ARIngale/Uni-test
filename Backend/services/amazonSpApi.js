const axios = require("axios")
const crypto = require("crypto")

// Amazon SP API configuration
const config = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  redirectUri: process.env.AMAZON_REDIRECT_URI,
  region: process.env.AMAZON_REGION || "eu", // Use 'eu' for India
  sandbox: process.env.AMAZON_SANDBOX === "true",
  applicationId: process.env.AMAZON_APP_ID,
}

// Get the base URL for the Amazon SP API based on the region
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

// Get the authorization URL for Amazon SP API OAuth
const getAuthUrl = (state) => {
  const baseUrl = "https://sellercentral.amazon.in/apps/authorize/consent"
  const params = new URLSearchParams({
    application_id: config.applicationId,
    state,
    version: "beta",
  })

  return `${baseUrl}?${params.toString()}`
}

// Exchange the authorization code for access and refresh tokens
const exchangeCode = async (code) => {
  try {
    const response = await axios.post(
      "https://api.amazon.com/auth/o2/token",
      {
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    return response.data
  } catch (error) {
    console.error("Error exchanging code for tokens:", error.response?.data || error.message)
    throw new Error("Failed to exchange authorization code")
  }
}

// Refresh the access token
const refreshAccessToken = async (refreshToken) => {
  try {
    const response = await axios.post(
      "https://api.amazon.com/auth/o2/token",
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    return response.data
  } catch (error) {
    console.error("Error refreshing access token:", error.response?.data || error.message)
    throw new Error("Failed to refresh access token")
  }
}

const getRestrictedDataToken = async (accessToken) => {
  try {
    const response = await axios.post(
      "https://sellingpartnerapi-eu.amazon.com/tokens/2021-03-01/restrictedDataToken",
      {
        targetApplication: config.applicationId,
        restrictedResources: [
          {
            method: "GET",
            path: "/orders/v0/orders",
            dataElements: ["shippingAddress", "buyerInfo"]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-amz-access-token": accessToken,
          "Content-Type": "application/json",
        },
      }
    )

    return response.data.restrictedDataToken
  } catch (error) {
    console.error("Error getting RDT:", error.response?.data || error.message)
    throw new Error("Failed to fetch restricted data token")
  }
}

// Get the order count from the Amazon SP API
const getOrderCount = async (accessToken, sellerId) => {
  try {
    // Step 1: Get RDT
    const restrictedToken = await getRestrictedDataToken(accessToken)

    // Step 2: Set date range
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const createdAfter = thirtyDaysAgo.toISOString()
    const createdBefore = now.toISOString()

    // Step 3: Call SP API Orders endpoint using RDT
    const response = await axios.get(`${getBaseUrl()}/orders/v0/orders`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-amz-access-token": restrictedToken, // ⬅️ Use the RDT here
        "Content-Type": "application/json",
      },
      params: {
        MarketplaceIds: "A21TJRUUN4KGV", // India marketplace ID
        CreatedAfter: createdAfter,
        CreatedBefore: createdBefore,
      },
    })

    // Step 4: Return order count
    const orders = response?.data?.payload?.Orders || []
    return orders?.length
  } catch (error) {
    console.error("Error getting order count:", error.response?.data || error.message)
    throw new Error("Failed to get order count from Amazon SP API")
  }
}

const getRecentOrders = async (accessToken, sellerId) => {
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const createdAfter = thirtyDaysAgo.toISOString()
    const createdBefore = now.toISOString()

    let allOrders = []
    let nextToken = null
    const restrictedToken = await getRestrictedDataToken(accessToken)

    do {
      const response = await axios.get(`${getBaseUrl()}/orders/v0/orders`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-amz-access-token": restrictedToken,
          "Content-Type": "application/json",
        },
        params: {
          MarketplaceIds: "A21TJRUUN4KGV", // Replace if using other marketplaces
          CreatedAfter: createdAfter,
          CreatedBefore: createdBefore,
          ...(nextToken && { NextToken: nextToken }),
        },
      })

      const payload = response?.data?.payload
      if (!payload?.Orders?.length) break;
      const orders = payload?.Orders || []
      allOrders.push(...orders)

      nextToken = payload?.NextToken || null
    } while (nextToken)

    const formattedOrders = allOrders?.map(order => ({
      orderId: order?.AmazonOrderId,
      orderDate: order?.PurchaseDate?.split("T")[0],
      status: order?.OrderStatus,
    }))

    return formattedOrders
  } catch (error) {
    console.error("Error getting recent orders:", error.response?.data || error.message)
    throw new Error("Failed to get recent orders from Amazon SP API")
  }
}



module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getOrderCount,
  getRecentOrders
}
