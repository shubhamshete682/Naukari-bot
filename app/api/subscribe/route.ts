import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Bypass corporate network/VPN self-signed certificate issues locally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
  try {
    const subscription = await req.json();
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Store the subscription in Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { 
          endpoint: subscription.endpoint, 
          p256dh: subscription.keys.p256dh, 
          auth: subscription.keys.auth 
        },
        { onConflict: 'endpoint' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
