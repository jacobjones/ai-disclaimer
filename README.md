# AI Disclaimer - Image Library

A Next.js application for browsing and downloading images from the Optimizely CMP (Content Management Platform) with AI disclosure information.

## Features

- **Image Gallery**: Browse images from the Optimizely CMP library with thumbnail previews
- **Pagination**: Navigate through large image collections with page-based pagination
- **AI Disclosure Filter**: Filter images by AI involvement category:
  - AI-assisted
  - AI-generated
  - AI-generated people, events or scenes
  - AI-manipulated
- **Download with Disclaimer**: Download selected images with automatically applied disclaimer messages based on the AI involvement category
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Setup

### Prerequisites

- Node.js 18+ installed
- Optimizely CMP OAuth credentials:
  - Client ID
  - Client Secret
  - API Base URL (optional, defaults to `https://api.cmp.optimizely.com`)
  - Auth Base URL (optional, defaults to `https://accounts.cmp.optimizely.com`)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AiDisclaimer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create a .env.local file in the project root with your OAuth credentials
echo "OPTIMIZELY_CLIENT_ID=your_client_id_here" > .env.local
echo "OPTIMIZELY_CLIENT_SECRET=your_client_secret_here" >> .env.local
echo "OPTIMIZELY_BASE_URL=https://api.cmp.optimizely.com" >> .env.local
echo "OPTIMIZELY_AUTH_BASE_URL=https://accounts.cmp.optimizely.com" >> .env.local
echo "OPTIMIZELY_AI_FIELD_ID=6a8fe45342cbe42b3725398d" >> .env.local
echo "OPTIMIZELY_AI_FIELD_NONE_ID=6a8fe45342cbe42b37253990" >> .env.local
```

Replace the placeholder values with your actual Optimizely CMP OAuth credentials. The field IDs and base URLs are optional and default to the standard Optimizely values.

### Running the Application

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Building for Production

Build the application:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Integration

### Assets Endpoint

The application fetches images from the Optimizely CMP assets endpoint:
- **Endpoint**: `GET /v3/assets`
- **Base URL**: Configured via `OPTIMIZELY_BASE_URL`
- **Query Parameters**:
  - `type=image` - Filter by asset type
  - `offset` - Pagination offset
  - `page_size` - Number of assets per page
  - `fields` - Optional field filter (base64 encoded JSON array)
- **Field ID**: `6a8fe45342cbe42b3725398d` - AI disclosure field
- **Field Encoding**: The `fields` parameter must be a base64-encoded JSON array with structure: `[{"id": "field_id", "values": ["value_id"]}]`

### Disclaimer Mappings

The following messages are displayed based on the selected AI disclosure filter:

- **AI-assisted** (`6a8fe45342cbe42b3725398f`): "Created with AI assistance"
- **AI-generated** (`6a8fe45342cbe42b37253991`): "Generated using AI"
- **AI-manipulated** (`6a8fe45342cbe42b3725398e`): "Materially modified using AI"
- **AI-generated people, events or scenes** (`6a9ac74a4f2e104e55c87272`): "AI-generated. This depiction is not real."

## Architecture

### File Structure

```
app/
├── layout.js              # Root layout component
├── globals.css            # Global styles
├── page.js               # Main image gallery page
├── page.css              # Gallery page styles
└── api/
    └── assets/
        └── route.js      # API route for fetching assets from Optimizely CMP
lib/
└── auth.js               # Shared OAuth2 authentication utilities
```

### Components

- **Main Gallery**: Displays paginated grid of image thumbnails with selection capability
- **Filter Dropdown**: Allows users to filter images by AI disclosure category
- **Preview Section**: Shows selected image in detail with download button and disclaimer
- **Pagination Controls**: Navigate through image pages

## Environment Variables

- `OPTIMIZELY_CLIENT_ID`: Your Optimizely CMP OAuth2 client ID
- `OPTIMIZELY_CLIENT_SECRET`: Your Optimizely CMP OAuth2 client secret
- `OPTIMIZELY_AI_FIELD_ID`: The Optimizely CMP field ID for AI disclosure status (defaults to `6a8fe45342cbe42b3725398d`)
- `OPTIMIZELY_AI_FIELD_NONE_ID`: The choice ID for "None" in the AI disclosure field (defaults to `6a8fe45342cbe42b37253990`)
- `OPTIMIZELY_BASE_URL` (optional): Base URL for Optimizely CMP API (defaults to `https://api.cmp.optimizely.com`)
- `OPTIMIZELY_AUTH_BASE_URL` (optional): Base URL for OAuth2 token endpoint (defaults to `https://accounts.cmp.optimizely.com`)

## Troubleshooting

### Images not loading
- Verify your `OPTIMIZELY_API_KEY` is correct in `.env.local`
- Check that the API key has access to the image assets in your CMP

### Filter not working
- Ensure the field ID `6a8fe45342cbe42b3725398d` is correct in your Optimizely CMP
- Verify the filter options are correctly set up in the CMP

## Security Considerations

- OAuth2 credentials (Client ID and Secret) are kept server-side and never exposed to the client
- Access tokens are cached in memory with automatic refresh (~55 minute TTL)
- Token cache is shared across API routes for efficiency
- Failed requests on 401 (Unauthorized) automatically refresh the token and retry
- Asset listing requires OAuth2 authentication (server-side via API proxy)
- Downloads use public URLs provided by Optimizely CMP (no authentication required)
- Environment variables are never committed to version control (see `.gitignore`)

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
