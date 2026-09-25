import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Bypass corporate network/VPN self-signed certificate issues locally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
       return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }
    
    // 1. Fetch Jobs by hitting our own /api/jobs route
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    
    // Call the scraper
    const jobsRes = await fetch(`${baseUrl}/api/jobs?keyword=mern%20stack`);
    const jobsData = await jobsRes.json();
    const jobs = jobsData.jobs || [];

    if (jobs.length === 0) {
       return NextResponse.json({ message: 'No jobs found on Naukri' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Filter out jobs we've already notified about
    const { data: notified } = await supabase.from('notified_jobs').select('id');
    const notifiedIds = new Set(notified?.map(n => n.id) || []);
    
    const newJobs = jobs.filter((j: any) => !notifiedIds.has(j.id));

    if (newJobs.length === 0) {
       return NextResponse.json({ message: 'No new jobs to notify about.' });
    }

    // 3. Mark the new jobs as notified in Supabase
    const insertData = newJobs.map((j: any) => ({ id: j.id }));
    await supabase.from('notified_jobs').insert(insertData);

    // 4. Send Push Notifications for each new job
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('*');
    
    if (subscriptions && subscriptions.length > 0) {
       for (const job of newJobs) {
           const payload = JSON.stringify({
               title: 'New Naukri Match!',
               body: `${job.title} at ${job.company}`,
               url: job.url,
           });

           for (const sub of subscriptions) {
               const pushSubscription = {
                   endpoint: sub.endpoint,
                   keys: {
                       p256dh: sub.p256dh,
                       auth: sub.auth
                   }
               };

               try {
                   await webpush.sendNotification(pushSubscription, payload);
               } catch (err) {
                   console.error('Failed to send push, removing subscription', err);
                   // If endpoint is dead, remove it
                   await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
               }
           }
       }
    }

    return NextResponse.json({ 
       message: `Cron finished. Sent notifications for ${newJobs.length} new jobs.`,
       jobs: newJobs
    });
  } catch (err: any) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
