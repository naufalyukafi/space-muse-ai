import { getAuthContext } from '@/lib/supabase-server';
import {
  apiSuccess,
  apiUnauthorized,
  apiServerError
} from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return apiUnauthorized();
    }

    const { scopedClient } = auth;

    const { data: generations, error: queryError } = await scopedClient
      .from('generations')
      .select('id, original_url, result_url, room_type, style, palette, notes, prompt_built, status, created_at')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('Error fetching generations:', queryError);
      return apiServerError('Server error, please try again', 'DATABASE_ERROR');
    }

    return apiSuccess(generations || []);

  } catch (error: unknown) {
    console.error('Unexpected server error in /api/gallery:', error);
    return apiServerError('Server error, please try again', 'UNEXPECTED_ERROR');
  }
}
