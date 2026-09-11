#!/usr/bin/env node

/**
 * Build-time script to fetch and embed field choices
 * Runs during npm run build to populate static field data
 */

const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=').replace(/^["']|["']$/g, '')
      if (key && !process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

const API_BASE_URL = process.env.OPTIMIZELY_BASE_URL || 'https://api.cmp.optimizely.com'
const AUTH_BASE_URL = process.env.OPTIMIZELY_AUTH_BASE_URL || 'https://accounts.cmp.optimizely.com'
const AI_FIELD_ID = process.env.OPTIMIZELY_AI_FIELD_ID || '6a8fe45342cbe42b3725398d'
const AI_FIELD_NONE_ID = process.env.OPTIMIZELY_AI_FIELD_NONE_ID || '6a8fe45342cbe42b37253990'
const CLIENT_ID = process.env.OPTIMIZELY_CLIENT_ID
const CLIENT_SECRET = process.env.OPTIMIZELY_CLIENT_SECRET

async function getAccessToken() {
  const tokenUrl = `${AUTH_BASE_URL}/o/oauth2/v1/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function fetchFieldChoices() {
  const accessToken = await getAccessToken()
  const fieldsUrl = `${API_BASE_URL}/v3/fields?ids=${AI_FIELD_ID}`

  const response = await fetch(fieldsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch field: ${response.statusText}`)
  }

  const data = await response.json()
  const field = data.data?.[0]

  if (!field) {
    throw new Error('No field data returned from API')
  }

  // Filter out the "None" choice
  const choices = field.choices.filter((c) => c.id !== AI_FIELD_NONE_ID)

  // Build disclaimer messages
  const disclaimerMessages = {}
  field.choices.forEach((choice) => {
    if (choice.id !== AI_FIELD_NONE_ID) {
      disclaimerMessages[choice.id] = choice.name
    }
  })

  return {
    choices,
    disclaimerMessages,
    noneChoiceId: AI_FIELD_NONE_ID,
  }
}

async function main() {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.warn(
        'Skipping build-time field choices fetch: OPTIMIZELY_CLIENT_ID or OPTIMIZELY_CLIENT_SECRET not set'
      )
      return
    }

    console.log('Fetching field choices at build time...')
    const fieldData = await fetchFieldChoices()

    // Write to public directory so it can be imported
    const outputDir = path.join(__dirname, '..', 'public', 'data')
    const outputFile = path.join(outputDir, 'field-choices.json')

    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputFile, JSON.stringify(fieldData, null, 2))
    console.log(`✓ Field choices written to ${outputFile}`)
  } catch (error) {
    console.error('Error fetching field choices at build time:', error)
    process.exit(1)
  }
}

main()
