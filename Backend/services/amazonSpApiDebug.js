const axios = require("axios")

// Enhanced debugging and troubleshooting utilities
const config = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  redirectUri: process.env.AMAZON_REDIRECT_URI,
  region: process.env.AMAZON_REGION || "eu",
  sandbox: process.env.AMAZON_SANDBOX === "true",
  applicationId: process.env.AMAZON_APP_ID,
}

// Debug function to check all configurations
const debugConfiguration = () => {
  console.log("=== Amazon SP API Configuration Debug ===")
  console.log("Client ID:", config.clientId ? "✓ Set" : "✗ Missing")
  console.log("Client Secret:", config.clientSecret ? "✓ Set" : "✗ Missing")
  console.log("Redirect URI:", config.redirectUri || "✗ Missing")
  console.log("Region:", config.region)
  console.log("Sandbox Mode:", config.sandbox)
  console.log("Application ID:", config.applicationId ? "✓ Set" : "✗ Missing")
  console.log("==========================================")
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

// Enhanced token debugging
const debugTokenInfo = async (accessToken) => {
  try {
    console.log("=== Token Debug Information ===")
    console.log("Access Token Length:", accessToken ? accessToken.length : "No token")
    console.log("Token Prefix:", accessToken ? accessToken.substring(0, 20) + "..." : "No token")

    // Try to decode token info (if it's a JWT)
    if (accessToken && accessToken.includes(".")) {
      try {
        const parts = accessToken.split(".")
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString())
          console.log("Token Payload:", {
            iss: payload.iss,
            aud: payload.aud,
            exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : "No expiry",
            scope: payload.scope,
          })
        }
      } catch (e) {
        console.log("Token is not JWT format")
      }
    }
    console.log("===============================")
  } catch (error) {
    console.log("Error debugging token:", error.message)
  }
}

// Test basic API connectivity
const testApiConnectivity = async (accessToken) => {
  try {
    console.log("=== Testing API Connectivity ===")
    debugConfiguration()
    await debugTokenInfo(accessToken)

    const baseUrl = getBaseUrl()
    console.log("Base URL:", baseUrl)

    // Test 1: Try to access the simplest endpoint first
    console.log("\n1. Testing basic API access...")
    try {
      const response = await axios.get(`${baseUrl}/sellers/v1/marketplaceParticipations`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-amz-access-token": accessToken,
          "Content-Type": "application/json",
          "User-Agent": "YourAppName/1.0 (Language=JavaScript)",
        },
        timeout: 10000,
      })
      console.log("✓ Basic API access successful")
      console.log("Marketplace Participations:", response.data.payload?.length || 0)
    } catch (error) {
      console.log("✗ Basic API access failed:")
      console.log("Status:", error.response?.status)
      console.log("Error:", error.response?.data?.errors?.[0] || error.message)
    }

    // Test 2: Check application permissions
    console.log("\n2. Testing application permissions...")
    try {
      const response = await axios.get(`${baseUrl}/applications/2023-11-30/applications`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-amz-access-token": accessToken,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      })
      console.log("✓ Application permissions check successful")
    } catch (error) {
      console.log("✗ Application permissions check failed:")
      console.log("Status:", error.response?.status)
      console.log("Error:", error.response?.data?.errors?.[0] || error.message)
    }

    // Test 3: Try Orders API with minimal parameters
    console.log("\n3. Testing Orders API access...")
    try {
      const testDate = new Date()
      testDate.setDate(testDate.getDate() - 1) // Yesterday

      const response = await axios.get(`${baseUrl}/orders/v0/orders`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-amz-access-token": accessToken,
          "Content-Type": "application/json",
        },
        params: {
          MarketplaceIds: "A21TJRUUN4KGV", // India
          CreatedAfter: testDate.toISOString(),
          MaxResultsPerPage: 1,
        },
        timeout: 10000,
      })
      console.log("✓ Orders API access successful")
      console.log("Orders found:", response.data.payload?.Orders?.length || 0)
    } catch (error) {
      console.log("✗ Orders API access failed:")
      console.log("Status:", error.response?.status)
      console.log("Error Details:", error.response?.data?.errors?.[0])

      // Detailed error analysis
      if (error.response?.status === 403) {
        console.log("\n🔍 403 Error Analysis:")
        console.log("This typically means one of the following:")
        console.log("1. Your application doesn't have 'Orders' role assigned")
        console.log("2. Your application is not approved for production use")
        console.log("3. The seller hasn't authorized your application properly")
        console.log("4. Wrong marketplace ID or region configuration")
      }
    }

    console.log("\n================================")
  } catch (error) {
    console.log("Error in connectivity test:", error.message)
  }
}

// Check seller authorization status
const checkSellerAuthorization = async (accessToken) => {
  try {
    console.log("=== Checking Seller Authorization ===")

    // Try to get seller information
    const baseUrl = getBaseUrl()
    const response = await axios.get(`${baseUrl}/sellers/v1/marketplaceParticipations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-amz-access-token": accessToken,
        "Content-Type": "application/json",
      },
    })

    const marketplaces = response.data.payload || []
    console.log("Authorized Marketplaces:")
    marketplaces.forEach((mp, index) => {
      console.log(`${index + 1}. ${mp.marketplace?.name} (${mp.marketplace?.id})`)
      console.log(`   Country: ${mp.marketplace?.countryCode}`)
      console.log(`   Participation: ${mp.participation?.isParticipating ? "Active" : "Inactive"}`)
    })

    return {
      success: true,
      marketplaces: marketplaces.length,
      details: marketplaces,
    }
  } catch (error) {
    console.log("Seller authorization check failed:")
    console.log("Status:", error.response?.status)
    console.log("Error:", error.response?.data?.errors?.[0] || error.message)
    return {
      success: false,
      error: error.response?.data?.errors?.[0] || error.message,
    }
  }
}

// Generate detailed troubleshooting report
const generateTroubleshootingReport = async (accessToken) => {
  console.log("\n" + "=".repeat(60))
  console.log("AMAZON SP API TROUBLESHOOTING REPORT")
  console.log("=".repeat(60))

  // Configuration check
  debugConfiguration()

  // Token check
  if (accessToken) {
    await debugTokenInfo(accessToken)
  } else {
    console.log("❌ No access token provided")
    return
  }

  // API connectivity test
  await testApiConnectivity(accessToken)

  // Seller authorization check
  const authResult = await checkSellerAuthorization(accessToken)

  console.log("\n" + "=".repeat(60))
  console.log("RECOMMENDATIONS:")
  console.log("=".repeat(60))

  if (!authResult.success) {
    console.log("🔧 IMMEDIATE ACTIONS NEEDED:")
    console.log("1. Verify your application is approved in Amazon Developer Console")
    console.log("2. Check that 'Orders' role is assigned to your application")
    console.log("3. Ensure the seller has properly authorized your application")
    console.log("4. Verify you're using the correct region and marketplace IDs")
  } else {
    console.log("✅ Basic authorization is working")
    console.log("🔧 If Orders API still fails, check:")
    console.log("1. Application approval status for Orders role")
    console.log("2. Seller's specific permissions for your application")
  }

  console.log("\n📋 CHECKLIST:")
  console.log("□ Application created in Amazon Developer Console")
  console.log("□ Application approved by Amazon (can take 1-2 weeks)")
  console.log("□ 'Orders' role requested and approved")
  console.log("□ Seller has authorized your application")
  console.log("□ Correct region and marketplace configuration")
  console.log("□ Valid redirect URI configured")

  console.log("=".repeat(60))
}

module.exports = {
  debugConfiguration,
  testApiConnectivity,
  checkSellerAuthorization,
  generateTroubleshootingReport,
  debugTokenInfo,
}
