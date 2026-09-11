import { getAccessToken, clearTokenCache } from '@/lib/auth'

export async function GET(request) {
  const fieldId = process.env.OPTIMIZELY_AI_FIELD_ID || '6a8fe45342cbe42b3725398d'
  const noneChoiceId = process.env.OPTIMIZELY_AI_FIELD_NONE_ID || '6a8fe45342cbe42b37253990'

  const baseUrl = process.env.OPTIMIZELY_BASE_URL || 'https://api.cmp.optimizely.com'
  const fieldsUrl = new URL(`${baseUrl}/v3/fields`)
  fieldsUrl.searchParams.set('ids', fieldId)

  try {
    const accessToken = await getAccessToken()

    const response = await fetch(fieldsUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`Fields API Error [${response.status}]:`, errorBody)

      if (response.status === 401) {
        clearTokenCache()
        const newAccessToken = await getAccessToken()
        const retryResponse = await fetch(fieldsUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${newAccessToken}`,
          },
        })

        if (!retryResponse.ok) {
          const retryErrorBody = await retryResponse.text()
          console.error(`Fields API Error after retry [${retryResponse.status}]:`, retryErrorBody)
          return Response.json(
            { error: `API error: ${retryResponse.statusText}`, details: retryErrorBody },
            { status: retryResponse.status }
          )
        }

        const data = await retryResponse.json()
        data.none_choice_id = noneChoiceId
        return Response.json(data)
      }

      return Response.json(
        { error: `API error: ${response.statusText}`, details: errorBody },
        { status: response.status }
      )
    }

    const data = await response.json()
    data.none_choice_id = noneChoiceId
    return Response.json(data)
  } catch (error) {
    console.error('Fields fetch error:', error)
    return Response.json(
      { error: `Failed to fetch fields: ${error.message}` },
      { status: 500 }
    )
  }
}
