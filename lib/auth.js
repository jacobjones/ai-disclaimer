let cachedAccessToken = null
let tokenExpiry = null

export async function getAccessToken() {
  // Return cached token if still valid
  if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('Using cached OAuth token')
    return cachedAccessToken
  }

  const authBaseUrl = process.env.OPTIMIZELY_AUTH_BASE_URL || 'https://accounts.cmp.optimizely.com'
  const clientId = process.env.OPTIMIZELY_CLIENT_ID
  const clientSecret = process.env.OPTIMIZELY_CLIENT_SECRET
  const tokenUrl = `${authBaseUrl}/o/oauth2/v1/token`

  if (!clientId || !clientSecret) {
    throw new Error('Missing OAuth credentials: OPTIMIZELY_CLIENT_ID or OPTIMIZELY_CLIENT_SECRET not set')
  }

  console.log(`Requesting OAuth token from: ${tokenUrl}`)

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`Token request failed [${response.status}]:`, errorBody)
      throw new Error(`Token request failed: ${response.statusText} - ${errorBody}`)
    }

    const data = await response.json()
    if (!data.access_token) {
      console.error('Token response missing access_token:', data)
      throw new Error('Token response missing access_token')
    }

    cachedAccessToken = data.access_token
    // Cache token for 55 minutes (assuming 1 hour expiry)
    tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 300000

    return cachedAccessToken
  } catch (error) {
    console.error('OAuth token fetch error:', error)
    throw new Error(`Failed to get access token: ${error.message}`)
  }
}

export function clearTokenCache() {
  cachedAccessToken = null
  tokenExpiry = null
}
