import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase server configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

// Bypasses Row Level Security (RLS) for server-side generation updates, storage uploads, etc.
// But we should always validate user credentials where client scoped security is needed.
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Auto-initialize storage buckets if they do not exist
export async function initStorage() {
  const buckets = ['room-uploads', 'room-results'];
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabaseServer.storage.getBucket(bucket);
      
      // If bucket does not exist or we get an error, attempt to create it
      if (error || !data) {
        console.log(`Creating bucket '${bucket}'...`);
        const { error: createError } = await supabaseServer.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
        });
        
        if (createError) {
          console.error(`Failed to create bucket '${bucket}':`, createError.message);
        } else {
          console.log(`Bucket '${bucket}' created successfully.`);
        }
      }
    } catch (err) {
      console.error(`Error checking/creating storage bucket '${bucket}':`, err);
    }
  }
}
