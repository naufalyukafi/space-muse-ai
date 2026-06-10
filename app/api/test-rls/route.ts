import { supabaseServer, getAuthContext, initStorage } from '@/lib/supabase-server';
import { apiSuccess, apiServerError } from '@/lib/api-response';

export async function GET(request: Request) {
  try {
    // 0. Auto-initialize storage buckets on API trigger
    await initStorage();

    // 1. Service Role Client (Bypasses RLS)
    const { data: bypassData, error: bypassError } = await supabaseServer
      .from('generations')
      .select('*')
      .limit(1);

    // 2. Client using Auth Header (Respects RLS)
    const auth = await getAuthContext(request);
    let rlsData = null;
    let rlsError = null;

    if (auth) {
      const { userId, scopedClient } = auth;

      const { data, error } = await scopedClient
        .from('generations')
        .select('*')
        .limit(1);

      rlsData = data;
      rlsError = error;

      return apiSuccess({
        success: true,
        serviceRoleTest: {
          works: !bypassError,
          error: bypassError,
          data: bypassData
        },
        rlsTest: {
          userIdProvided: true,
          userId: userId,
          works: !rlsError,
          error: rlsError,
          data: rlsData
        },
        message: "RLS test route executed successfully. Ensure your SQL migrations are applied in Supabase Studio."
      });
    }

    return apiSuccess({
      success: true,
      serviceRoleTest: {
        works: !bypassError,
        error: bypassError,
        data: bypassData
      },
      rlsTest: {
        userIdProvided: false,
        userId: null,
        works: false,
        error: 'No Authorization header provided',
        data: null
      },
      message: "RLS test route executed successfully. Provide an Authorization header to test RLS."
    });
  } catch (error: unknown) {
    return apiServerError((error as Error).message, 'TEST_RLS_ERROR');
  }
}
