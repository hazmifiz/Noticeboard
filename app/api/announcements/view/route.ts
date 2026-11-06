import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cookie updates may be unavailable in this context.
          }
        },
      },
    }
  );

  // Check authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const payload = await request.json().catch(() => null);
  const announcementId = payload?.announcementId;

  if (
    typeof announcementId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      announcementId
    )
  ) {
    return NextResponse.json(
      { error: 'Invalid announcement ID' },
      { status: 400 }
    );
  }

  // Only allow views for published announcements
  const { data: announcement, error: announcementError } =
    await supabase
      .from('announcements')
      .select('id')
      .eq('id', announcementId)
      .eq('status', 'published')
      .maybeSingle();

  if (announcementError || !announcement) {
    return NextResponse.json(
      { error: 'Announcement not found' },
      { status: 404 }
    );
  }

  // Insert unique view
  const { error } = await supabase
    .from('announcement_views')
    .insert({
      announcement_id: announcementId,
      user_id: user.id,
    });

  // Duplicate view: already counted, no action needed
  if (error?.code === '23505') {
    return NextResponse.json({
      success: true,
      alreadyViewed: true,
    });
  }

  if (error) {
    console.error('Failed to record view:', error);

    return NextResponse.json(
      { error: 'Failed to record view' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    alreadyViewed: false,
  });
}