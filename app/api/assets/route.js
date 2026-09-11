import { getAccessToken, clearTokenCache } from '@/lib/auth'

async function getFieldChoices() {
  const fieldId = process.env.OPTIMIZELY_AI_FIELD_ID || '6a8fe45342cbe42b3725398d'
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
      throw new Error(`Failed to fetch field: ${response.statusText}`)
    }

    const data = await response.json()
    const field = data.data?.[0]
    return field?.choices || []
  } catch (error) {
    console.error('Error fetching field choices:', error)
    return []
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '0', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const offset = page * limit
  const filter = searchParams.get('filter')
  const filters = searchParams.get('filters')

  const baseUrl = process.env.OPTIMIZELY_BASE_URL || 'https://api.cmp.optimizely.com'
  const cmpUrl = new URL(`${baseUrl}/v3/assets`)
  cmpUrl.searchParams.set('type', 'image')
  cmpUrl.searchParams.set('offset', offset.toString())
  cmpUrl.searchParams.set('page_size', limit.toString())

  if (filters || filter) {
    const fieldId = process.env.OPTIMIZELY_AI_FIELD_ID || '6a8fe45342cbe42b3725398d'
    let filterValues = []

    if (filters) {
      // Multiple filters (comma-separated)
      filterValues = filters.split(',').filter(f => f.trim())
    } else if (filter) {
      // Handle exclusion filters (e.g., "exclude:6a8fe45342cbe42b37253990")
      if (filter.startsWith('exclude:')) {
        const noneChoiceId = process.env.OPTIMIZELY_AI_FIELD_NONE_ID || '6a8fe45342cbe42b37253990'
        const allChoices = await getFieldChoices()
        filterValues = allChoices
          .filter((c) => c.id !== noneChoiceId)
          .map((c) => c.id)
      } else {
        filterValues = [filter]
      }
    }

    if (filterValues.length > 0) {
      const fieldsArray = [
        {
          id: fieldId,
          values: filterValues
        }
      ]
      const fieldsJson = JSON.stringify(fieldsArray)
      const fieldsBase64 = Buffer.from(fieldsJson).toString('base64')
      cmpUrl.searchParams.set('fields', fieldsBase64)
    }
  }

  try {
    const accessToken = await getAccessToken()

    const response = await fetch(cmpUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`API Error [${response.status}]:`, errorBody)

      // If token expired, clear cache and retry once
      if (response.status === 401) {
        clearTokenCache()
        const newAccessToken = await getAccessToken()
        const retryResponse = await fetch(cmpUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${newAccessToken}`,
          },
        })

        if (!retryResponse.ok) {
          const retryErrorBody = await retryResponse.text()
          console.error(`API Error after retry [${retryResponse.status}]:`, retryErrorBody)
          return Response.json(
            { error: `API error: ${retryResponse.statusText}`, details: retryErrorBody },
            { status: retryResponse.status }
          )
        }

        const data = await retryResponse.json()
        return Response.json(data)
      }

      return Response.json(
        { error: `API error: ${response.statusText}`, details: errorBody },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Asset fetch error:', error)
    return Response.json(
      { error: `Failed to fetch assets: ${error.message}` },
      { status: 500 }
    )
  }
}
