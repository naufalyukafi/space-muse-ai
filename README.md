# Space Muce 🚀

Space Muce is a web application where users can upload a room photo, select a design style and color palette, and let Gemini AI generate a redesigned photorealistic version of the space.

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database & Storage**: Supabase (Postgres + Storage + Anonymous Auth)
- **AI Engine**: `gemini-2.5-flash-image` (via `@google/generative-ai` SDK)

---

## Getting Started

### 1. Setup Environment Variables

Clone the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Open `.env` and fill in the configuration values:
- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Project Anonymous API Key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Project Service Role API Key (used for server-side operations).

---

### 2. Setup Supabase Project

#### A. Enable Anonymous Sign-ins (Required)
1. Go to your **Supabase Dashboard** -> **Authentication** -> **Providers**.
2. Find the **Anonymous** provider in the list.
3. Turn on the **"Enable Anonymous Sign-ins"** toggle and click **Save**.

#### B. Database Migrations
We use the Supabase CLI to apply migrations:

1. **Link your project**:
   ```bash
   npx supabase link --project-ref <YOUR-PROJECT-REF>
   ```
2. **Push database changes**:
   ```bash
   npx supabase db push
   ```

---

### 3. Run the Development Server

First, install the project dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open the active port shown in your terminal (usually [http://localhost:3000](http://localhost:3000)) to access the application.

---

## API Documentation 🔌

All requests to the backend API require user authentication via Supabase anonymous sign-in token.

### Authentication Header
Every API request must include the following header:
```http
Authorization: Bearer <SUPABASE_ANON_JWT_TOKEN>
```

---

### 1. Generate Redesigned Space (`POST /api/generate`)
Redesigns a space (full room photo or furniture close-up photo) based on the chosen design style and color palette. Either `room_photo` or `reuse_image_url` must be provided.

#### Request Payload (`multipart/form-data`)
| Field Name | Type | Allowed Values / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `room_photo` | File | `image/jpeg`, `image/png`, `image/webp` (50KB to 10MB) | The photo to redesign. Required if `reuse_image_url` is not provided. |
| `reuse_image_url` | String | Valid Image URL | Original room image URL from a previous generation to redesign. Required if `room_photo` is not provided. |
| `room_type` | String | `living_room`, `bedroom`, `kitchen`, `bathroom`, `home_office` | The type of the room. |
| `style` | String | `minimalist`, `japandi`, `industrial`, `bohemian`, `scandinavian` | The target design style. |
| `palette` | String | `neutral`, `warm`, `cool`, `bold` | The target color palette. |
| `notes` | String | Optional (Max 200 characters) | Any additional styling/decor instructions. |

#### Example Response (Success - `200 OK`)
```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "id": "e9c20a5c-59db-49de-bd10-84c4897f26f2",
    "original_url": "https://[project-ref].supabase.co/storage/v1/object/public/room-uploads/[user-id]/[uuid]-original.jpg",
    "result_url": "https://[project-ref].supabase.co/storage/v1/object/public/room-results/[user-id]/[uuid]-result.jpg",
    "prompt_built": "Home Office:\nThis is a home office. Redesign this exact space keeping...",
    "room_type": "home_office",
    "style": "minimalist",
    "palette": "neutral",
    "notes": "Add a small plant",
    "status": "completed",
    "created_at": "2026-06-10T18:53:14.000Z"
  },
  "error": null,
  "code": null
}
```

---

### 2. Fetch User Generations (`GET /api/gallery`)
Retrieves a list of all historical generations created by the authenticated user, ordered by creation time descending.

#### Request Parameters
None. (Implicitly authenticated via Bearer token).

#### Example Response (Success - `200 OK`)
```json
{
  "status": "success",
  "message": "Success",
  "data": [
    {
      "original_url": "https://...",
      "result_url": "https://...",
      "status": "completed",
      "created_at": "2026-06-10T18:53:14.000Z"
    }
  ],
  "error": null,
  "code": null
}
```

---

### Error Responses
All error states return a standard error envelope structure:
```json
{
  "status": "error",
  "message": "AI is busy, try again later",
  "code": "TIMEOUT",
  "data": null,
  "error": "AI is busy, try again later"
}
```

#### Common Error Codes
*   `INVALID_PARAMS` (400 Bad Request): Missing fields, unsupported room type/style/palette, or unsupported file type.
*   `FILE_TOO_LARGE` (400 Bad Request): Uploaded file exceeds 10MB.
*   `FILE_TOO_SMALL` (400 Bad Request): Uploaded file is under 50KB.
*   `NOTES_TOO_LONG` (400 Bad Request): Notes exceed 200 characters.
*   `UNAUTHORIZED` (401 Unauthorized): Missing or invalid auth token.
*   `EMPTY_RESPONSE` (422 Unprocessable Entity): Gemini API returned an empty response.
*   `TIMEOUT` (504 Gateway Timeout): Gemini request timed out (limit: 45 seconds).
*   `GENERATION_ERROR` (500 Internal Server Error): Gemini generation failed.

