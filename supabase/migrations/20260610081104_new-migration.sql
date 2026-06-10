-- Create generations table
CREATE TABLE IF NOT EXISTS generations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  room_type     TEXT NOT NULL,
  style         TEXT NOT NULL,
  palette       TEXT NOT NULL,
  notes         TEXT,
  prompt_built  TEXT NOT NULL,
  original_url  TEXT NOT NULL,
  result_url    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'completed',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) on generations
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- Policy: users can perform all actions on their own generations
CREATE POLICY "users_own_generations" ON generations
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Index for faster queries sorted by creation date per user
CREATE INDEX IF NOT EXISTS idx_gen_user ON generations(user_id, created_at DESC);

-- Setup Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('room-uploads', 'room-uploads', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('room-results', 'room-results', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for room-uploads
CREATE POLICY "Allow public read access on room-uploads" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'room-uploads');

CREATE POLICY "Allow authenticated insert access on room-uploads" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'room-uploads' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policies for room-results
CREATE POLICY "Allow public read access on room-results" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'room-results');

CREATE POLICY "Allow authenticated insert access on room-results" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'room-results' AND (storage.foldername(name))[1] = auth.uid()::text
  );
