import sharp from 'sharp'
import { create as createFont } from 'fontkit'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getDisclaimerText, SUPPORTED_LOCALES } from '@/lib/locales'

let cachedFont = null

function loadFont() {
  if (cachedFont) return cachedFont

  const fontPath = join(process.cwd(), 'public/fonts/galano-grotesque/galano-grotesque-medium.woff2')
  const fontBuffer = readFileSync(fontPath)
  cachedFont = createFont(fontBuffer)
  return cachedFont
}

// Renders text as actual glyph outlines (SVG paths) instead of relying on
// font-family lookups, since serverless platforms like Vercel don't have any
// fonts installed for Sharp/librsvg to resolve at render time.
function textToGlyphPaths(text, fontSize, font) {
  const scale = fontSize / font.unitsPerEm
  const run = font.layout(text)

  let penX = 0
  const glyphs = run.glyphs.map((glyph, i) => {
    const position = run.positions[i]
    const x = penX + position.xOffset * scale
    penX += position.xAdvance * scale
    return { d: glyph.path.toSVG(), x }
  })

  return { glyphs, totalWidth: penX, scale }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('imageUrl')
  const choiceId = searchParams.get('choiceId')
  const filename = searchParams.get('filename')
  const locale = searchParams.get('locale') || 'en'
  const cropX = searchParams.get('cropX')
  const cropY = searchParams.get('cropY')
  const cropWidth = searchParams.get('cropWidth')
  const cropHeight = searchParams.get('cropHeight')

  if (!imageUrl || !choiceId) {
    return Response.json(
      { error: 'Missing imageUrl or choiceId parameter' },
      { status: 400 }
    )
  }

  if (!SUPPORTED_LOCALES.includes(locale)) {
    return Response.json(
      { error: `Unsupported locale: ${locale}. Supported locales: ${SUPPORTED_LOCALES.join(', ')}` },
      { status: 400 }
    )
  }

  console.log('Image with disclaimer request:', {
    imageUrl: imageUrl.substring(0, 50),
    choiceId,
    locale,
    filename,
    cropX,
    cropY,
    cropWidth,
    cropHeight
  })

  const disclaimerText = getDisclaimerText(choiceId, locale)
  if (!disclaimerText) {
    return Response.json(
      { error: 'Invalid choiceId' },
      { status: 400 }
    )
  }

  try {
    console.log('Adding disclaimer:', { choiceId, disclaimerText })

    // Fetch the image
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
    }

    let imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Get image metadata
    let metadata = await sharp(imageBuffer).metadata()
    let { width, height, format } = metadata
    const originalWidth = width
    const originalHeight = height

    console.log('Image dimensions:', { width, height, format })

    // Apply crop if provided and not cleared (0x0)
    const cropW = parseInt(cropWidth) || 0
    const cropH = parseInt(cropHeight) || 0

    if (cropW > 0 && cropH > 0) {
      const x = Math.round(parseInt(cropX) || 0)
      const y = Math.round(parseInt(cropY) || 0)
      const w = Math.round(cropW)
      const h = Math.round(cropH)

      console.log('Original image dimensions:', { width, height })
      console.log('Applying crop:', { x, y, width: w, height: h })

      imageBuffer = await sharp(imageBuffer)
        .extract({ left: x, top: y, width: w, height: h })
        .toBuffer()

      // Update dimensions after crop
      metadata = await sharp(imageBuffer).metadata()
      width = metadata.width
      height = metadata.height

      console.log('Image dimensions after crop:', { width, height })
    }

    // Create SVG with text rendered as glyph outlines (bottom right)
    const padding = Math.max(12, Math.min(width, height) * 0.02)
    const fontSize = Math.max(21, height * 0.0225)

    const font = loadFont()
    const { glyphs, totalWidth, scale } = textToGlyphPaths(disclaimerText, fontSize, font)

    const startX = width - padding - totalWidth
    const baselineY = height - padding

    const glyphPaths = glyphs
      .map(({ d, x }) => `<path d="${d}" transform="translate(${startX + x}, ${baselineY}) scale(${scale}, ${-scale})"/>`)
      .join('\n          ')

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="textShadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="2" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.8"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <!-- Semi-transparent white text with drop shadow, rendered as glyph outlines -->
        <g fill="white" opacity="0.9" filter="url(#textShadow)">
          ${glyphPaths}
        </g>
      </svg>
    `

    console.log('SVG overlay created')

    // Composite SVG over image and convert to original format
    let output = sharp(imageBuffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }])

    // Convert to original format, with fallback to JPEG
    const mimeType = format ? `image/${format}` : 'image/jpeg'
    // Normalize 'jpeg' to 'jpg' for file extension
    const ext = format === 'jpeg' ? 'jpg' : (format || 'jpg')

    if (format === 'png') {
      output = output.png()
    } else if (format === 'webp') {
      output = output.webp({ quality: 90 })
    } else if (format === 'gif') {
      output = output.gif()
    } else {
      // Default to JPEG for JPEG, unknown formats, etc.
      output = output.jpeg({ quality: 90 })
    }

    const outputBuffer = await output.toBuffer()

    console.log('Image with disclaimer created, size:', outputBuffer.length)

    // Use provided filename or generate a default one
    let downloadFilename
    if (filename) {
      // Check if filename already has the extension
      downloadFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`
    } else {
      downloadFilename = `image-with-disclaimer.${ext}`
    }

    console.log('Download filename:', downloadFilename)

    return new Response(outputBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
      },
    })
  } catch (error) {
    console.error('Error adding disclaimer:', error)
    return Response.json(
      { error: `Failed to add disclaimer: ${error.message}` },
      { status: 500 }
    )
  }
}
