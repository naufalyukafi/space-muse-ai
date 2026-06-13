# Space Muce

Space Muce lets users upload a room photo, select a style, and get an AI-generated redesign of that room. No login required — sessions are anonymous.

## Features

- Upload a room photo (JPEG/PNG/WebP, 50KB–10MB)
- Select room type: living room, bedroom, kitchen, bathroom, home office
- Select style: minimalist, japandi, industrial, bohemian, scandinavian
- Select color palette: neutral, warm, cool, bold
- Optional notes (max 200 chars)
- AI generates a photorealistic redesign of the same room
- Gallery shows all previous generations for the current session
- Click any card to pre-fill the form and regenerate with a new photo


## Local Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in values.
4. Enable Anonymous Sign-ins in your Supabase Dashboard under Authentication -> Providers -> Anonymous.
5. Set up the Supabase database migrations (choose one):
   - **Dashboard**: Paste and run the SQL from `migrations/001_create_generations.sql` in the Supabase SQL editor.
   - **Supabase CLI**: Link your project and push database changes:
     ```bash
     npx supabase link --project-ref <YOUR-PROJECT-REF>
     npx supabase db push
     ```
   *Note: This migration automatically handles creating the `room-uploads` and `room-results` storage buckets with the correct RLS policies—no manual bucket configuration is required.*
6. Run the dev server:
   ```bash
   npm run dev
   ```

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key_here # Google Gemini API key for running image generation
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here # Supabase project instance URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here # Supabase anonymous client API key for database access
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here # Supabase service role key to bypass RLS
```

## API Documentation

Requests require authentication: `Authorization: Bearer <SUPABASE_ANON_JWT_TOKEN>`

### 1. Generate Redesigned Space (`POST /api/generate`)
Redesigns a space based on the style and color palette. Either `room_photo` or `reuse_image_url` must be provided.

#### Request Payload (`multipart/form-data`)
| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `room_photo` | File | JPEG/PNG/WebP (50KB–10MB) | Room photo to redesign |
| `reuse_image_url` | String | Valid Image URL | Existing URL to redesign |
| `room_type` | String | living_room, bedroom, kitchen, bathroom, home_office | Room category |
| `style` | String | minimalist, japandi, industrial, bohemian, scandinavian | Target style |
| `palette` | String | neutral, warm, cool, bold | Target palette |
| `notes` | String | Optional (Max 200 characters) | Custom instructions |

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "original_url": "https://...",
    "result_url": "https://...",
    "prompt_built": "prompt...",
    "room_type": "home_office",
    "style": "minimalist",
    "palette": "neutral",
    "notes": "Add a plant",
    "status": "completed",
    "created_at": "timestamp"
  }
}
```

### 2. Fetch User Generations (`GET /api/gallery`)
Retrieves all historical generations created by the authenticated user.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [{
    "original_url": "https://...",
    "result_url": "https://...",
    "status": "completed",
    "created_at": "timestamp"
  }]
}
```

### Error Responses
All error states return the structure:
```json
{
  "status": "error",
  "message": "Error details",
  "code": "ERROR_CODE",
  "data": null
}
```
Codes: `INVALID_PARAMS` (400), `FILE_TOO_LARGE` (400), `FILE_TOO_SMALL` (400), `NOTES_TOO_LONG` (400), `UNAUTHORIZED` (401), `EMPTY_RESPONSE` (422), `TIMEOUT` (504), `GENERATION_ERROR` (500).

## Architecture Decisions

### Anonymous Authentication
Anonymous authentication avoids user onboarding friction for the MVP while isolating user data via RLS.

### Server-Only AI Calls
Gemini API calls are restricted to server-side `/api` routes to prevent exposing `GEMINI_API_KEY` to the browser.

### Postgres Row Level Security
Row Level Security (RLS) ensures users can only read and write their own database records.

### Supabase Storage
Large generated images are stored in Supabase Storage. Storing only URLs in Postgres keeps the database lean.

### Image Resizing via Jimp
Original images are resized server-side using Jimp before the Gemini API call to reduce payload size and latency. Jimp is used instead of Sharp because it is written in pure JavaScript and does not require native dependencies. This avoids deployment issues on Vercel Serverless Functions, where Sharp's native binary dependencies (`libvips`) fail to compile or load due to environment compatibility or Turbopack bundler mismatch.

### In-Memory Rate Limiting
Rate limiting is handled in-memory without Redis, which is sufficient for MVP/single-instance setups.

### Real-Time Progress Streaming (SSE)
Uses Server-Sent Events (SSE) to push granular execution status ("Preparing storage...", "Uploading and redesigning...", "Saving redesign...") back to the UI in real time.

### In-Flight Request Deduplication
Hashes incoming inputs (user, room type, style, palette, file size) to detect duplicate submissions and allow concurrent requests to safely subscribe to the same active promise.

### Parallel Operations
Concurrent execution of the original photo upload and the Gemini design generation via `Promise.all` minimizes request transaction latency.

### Image Magic Bytes Validation
Inspects initial byte signatures (JPEG, PNG, WebP header bytes) server-side to reject spoofed file uploads and guard the API.

### Orphaned Upload Cleanup
Automatically cleans up/removes original image uploads from Supabase Storage if the concurrent Gemini AI request fails, keeping storage footprint clean.

## Known Limitations

- In-memory rate limiting resets on server restart and is not shared across multiple Vercel instances.
- Best results require bright, wide-angle room photos. Dark or narrow-angle images may reduce layout reconstruction accuracy.
- Anonymous sessions are tied to browser localStorage. Clearing browser data loses gallery history.
- No image compression on the client side. Large files are resized server-side before Gemini.
