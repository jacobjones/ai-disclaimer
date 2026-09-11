import { getAccessToken, clearTokenCache } from '@/lib/auth'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get('assetId')

  if (!assetId) {
    return Response.json(
      { error: 'Missing assetId parameter' },
      { status: 400 }
    )
  }

  const aiFieldId = process.env.OPTIMIZELY_AI_FIELD_ID || '6a8fe45342cbe42b3725398d'
  const baseUrl = process.env.OPTIMIZELY_BASE_URL || 'https://api.cmp.optimizely.com'
  const fieldsUrl = `${baseUrl}/v3/assets/${assetId}/fields`

  console.log('Asset fields request:', { assetId, aiFieldId, fieldsUrl })

  try {
    const accessToken = await getAccessToken()

    const response = await fetch(fieldsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`Asset fields API Error [${response.status}] for URL: ${fieldsUrl}`)
      console.error('Error body:', errorBody)

      if (response.status === 401) {
        clearTokenCache()
        const newAccessToken = await getAccessToken()
        const retryResponse = await fetch(fieldsUrl, {
          headers: {
            'Authorization': `Bearer ${newAccessToken}`,
          },
        })

        if (!retryResponse.ok) {
          const retryErrorBody = await retryResponse.text()
          console.error(`Asset fields API Error after retry [${retryResponse.status}]:`, retryErrorBody)
          return Response.json(
            { error: `API error: ${retryResponse.statusText}`, details: retryErrorBody },
            { status: retryResponse.status }
          )
        }

        const data = await retryResponse.json()
        // Find the AI field from the array of fields
        const aiField = data.data?.find(f => f.id === aiFieldId)
        return Response.json({ field: aiField })
      }

      return Response.json(
        { error: `API error: ${response.statusText}`, details: errorBody },
        { status: response.status }
      )
    }

    const data = await response.json()
    // Find the AI field from the array of fields
    const aiField = data.data?.find(f => f.id === aiFieldId)
    return Response.json({ field: aiField })
  } catch (error) {
    console.error('Asset fields fetch error:', error)
    return Response.json(
      { error: `Failed to fetch asset fields: ${error.message}` },
      { status: 500 }
    )
  }
}
