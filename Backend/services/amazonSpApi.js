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

// Validate configuration
const validateConfig = () => {
  const required = ["clientId", "clientSecret", "redirectUri", "applicationId"]
  const missing = required.filter((key) => !config[key])

  if (missing.length > 0) {
    throw new Error(`Missing required Amazon SP API configuration: ${missing.join(", ")}`)
  }
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

  if (!regionMap[region]) {
    throw new Error(`Invalid region: ${region}. Must be one of: na, eu, fe`)
  }

  return regionMap[region][environment]
}

// Get the authorization URL for Amazon SP API OAuth
const getAuthUrl = (state) => {
  validateConfig()

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
    validateConfig()

    console.log("Exchanging authorization code for tokens...")

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
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    )

    console.log("Successfully exchanged code for tokens")
    return response.data
  } catch (error) {
    console.error("Error exchanging code for tokens:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })
    throw new Error(
      `Failed to exchange authorization code: ${error.response?.data?.error_description || error.message}`,
    )
  }
}

// Refresh the access token
const refreshAccessToken = async (refreshToken) => {
  try {
    validateConfig()

    if (!refreshToken) {
      throw new Error("Refresh token is required")
    }

    console.log("Refreshing access token...")

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
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    )

    console.log("Successfully refreshed access token")
    return response.data
  } catch (error) {
    console.error("Error refreshing access token:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })
    throw new Error(`Failed to refresh access token: ${error.response?.data?.error_description || error.message}`)
  }
}

const getRestrictedDataToken = async (accessToken) => {
  try {
    if (!accessToken) {
      throw new Error("Access token is required")
    }

    console.log("Getting restricted data token...")

    const baseUrl = getBaseUrl()
    const response = await axios.post(
      `${baseUrl}/tokens/2021-03-01/restrictedDataToken`,
      {
        restrictedResources: [
          {
            method: "GET",
            path: "/orders/v0/orders",
            dataElements: ["shippingAddress", "buyerInfo"],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-amz-access-token": accessToken,
          "Content-Type": "application/json",
        },
      },
    )

    console.log("Successfully obtained restricted data token")
    return response.data.restrictedDataToken
  } catch (error) {
    console.error("Error getting RDT:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })

    // If RDT fails, we can still try without it for basic order data
    console.log("RDT failed, will attempt to fetch orders without restricted data")
    return null
  }
}

// Get the order count from the Amazon SP API
const getOrderCount = async (accessToken, sellerId) => {
  try {
    if (!accessToken) {
      throw new Error("Access token is required")
    }

    console.log("Fetching order count...")

    // Step 1: Try to get RDT (optional)
    const restrictedToken = await getRestrictedDataToken(accessToken)

    // Step 2: Set date range
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const createdAfter = thirtyDaysAgo.toISOString()
    const createdBefore = now.toISOString()

    // Step 3: Call SP API Orders endpoint
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }

    // Use RDT if available, otherwise use regular access token
    if (restrictedToken) {
      headers["x-amz-access-token"] = restrictedToken
    } else {
      headers["x-amz-access-token"] = accessToken
    }

    const response = await axios.get(`${getBaseUrl()}/orders/v0/orders`, {
      headers,
      params: {
        MarketplaceIds: "A21TJRUUN4KGV", // India marketplace ID
        CreatedAfter: createdAfter,
        CreatedBefore: createdBefore,
        MaxResultsPerPage: 100, // Add pagination limit
      },
    })

    // Step 4: Return order count
    const orders = response?.data?.payload?.Orders || []
    console.log(`Successfully fetched ${orders.length} orders`)
    return orders.length
  } catch (error) {
    console.error("Error getting order count:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })

    // Provide more specific error messages
    if (error.response?.status === 403) {
      throw new Error(
        "Access denied. Please check your Amazon SP API permissions and ensure your application is approved.",
      )
    } else if (error.response?.status === 401) {
      throw new Error("Authentication failed. Please reconnect your Amazon account.")
    } else if (error.response?.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.")
    }

    throw new Error(`Failed to get order count: ${error.response?.data?.errors?.[0]?.message || error.message}`)
  }
}

const getRecentOrders = async (accessToken, sellerId) => {
  try {
    if (!accessToken) {
      throw new Error("Access token is required")
    }

    console.log("Fetching recent orders...")

    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const createdAfter = thirtyDaysAgo.toISOString()
    const createdBefore = now.toISOString()

    const allOrders = []
    let nextToken = null
    const restrictedToken = await getRestrictedDataToken(accessToken)

    do {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      }

      // Use RDT if available, otherwise use regular access token
      if (restrictedToken) {
        headers["x-amz-access-token"] = restrictedToken
      } else {
        headers["x-amz-access-token"] = accessToken
      }

      const params = {
        MarketplaceIds: "A21TJRUUN4KGV", // India marketplace ID
        CreatedAfter: createdAfter,
        CreatedBefore: createdBefore,
        MaxResultsPerPage: 50, // Reduce page size for better performance
      }

      if (nextToken) {
        params.NextToken = nextToken
      }

      const response = await axios.get(`${getBaseUrl()}/orders/v0/orders`, {
        headers,
        params,
      })

      const payload = response?.data?.payload
      if (!payload?.Orders?.length) {
        console.log("No more orders found")
        break
      }

      const orders = payload.Orders || []
      allOrders.push(...orders)
      console.log(`Fetched ${orders.length} orders, total: ${allOrders.length}`)

      nextToken = payload.NextToken || null

      // Add a small delay to avoid rate limiting
      if (nextToken) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } while (nextToken && allOrders.length < 200) // Limit total orders to prevent timeout

    const formattedOrders = allOrders.map((order) => ({
      orderId: order.AmazonOrderId,
      orderDate: order.PurchaseDate ? order.PurchaseDate.split("T")[0] : "N/A",
      status: order.OrderStatus || "Unknown",
      amount: order.OrderTotal ? `${order.OrderTotal.CurrencyCode} ${order.OrderTotal.Amount}` : "N/A",
    }))

    console.log(`Successfully formatted ${formattedOrders.length} orders`)
    return formattedOrders
  } catch (error) {
    console.error("Error getting recent orders:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    })

    // Provide more specific error messages
    if (error.response?.status === 403) {
      throw new Error("Access denied. Please check your Amazon SP API permissions.")
    } else if (error.response?.status === 401) {
      throw new Error("Authentication failed. Please reconnect your Amazon account.")
    } else if (error.response?.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.")
    }

    throw new Error(`Failed to get recent orders: ${error.response?.data?.errors?.[0]?.message || error.message}`)
  }
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getOrderCount,
  getRecentOrders,
  validateConfig,
}
