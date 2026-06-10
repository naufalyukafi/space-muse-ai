import { NextResponse } from 'next/server';
import { supabaseServer, initStorage } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

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
    const authHeader = request.headers.get('Authorization');
    let rlsData = null;
    let rlsError = null;
    let userId = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      // Get the user from the token
      const { data: { user } } = await supabaseServer.auth.getUser(token);
      userId = user?.id;

      // Create a scoped client with the user's JWT to test RLS
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      
      const scopedClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      });

      const { data, error } = await scopedClient
        .from('generations')
        .select('*')
        .limit(1);
        
      rlsData = data;
      rlsError = error;
    }

    return NextResponse.json({
      success: true,
      serviceRoleTest: {
        works: !bypassError,
        error: bypassError,
        data: bypassData
      },
      rlsTest: {
        userIdProvided: !!userId,
        userId: userId,
        works: !rlsError,
        error: rlsError,
        data: rlsData
      },
      message: "RLS test route executed successfully. Ensure your SQL migrations are applied in Supabase Studio."
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
