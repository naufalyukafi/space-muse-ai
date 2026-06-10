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
