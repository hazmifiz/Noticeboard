import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // ==========================================
  // GATE 1: Authentication Guard
  // ==========================================
  // If user is not signed on and trying to access protected routes, redirect to /login
  const isAuthRoute = path.startsWith('/login');
  
  if (!user && !isAuthRoute && path !== '/') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is logged in and visits /login, redirect straight to feed
  if (user && isAuthRoute) {
    url.pathname = '/feed';
    return NextResponse.redirect(url);
  }

  // If user is logged in, fetch their app role from the public.users table
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('roles(role_name)')
      .eq('id', user.id)
      .single();

    // Safely extract role name (defaults to 'Student' if not found)
    // @ts-ignore
    const roleName = userData?.roles?.role_name || 'Student';

    // ==========================================
    // GATE 3: Publisher Authorization Guard (/create)
    // ==========================================
    if (path.startsWith('/create') && roleName !== 'Publisher' && roleName !== 'Admin') {
      url.pathname = '/feed';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }

    // ==========================================
    // GATE 4: Admin Authorization Guard (/admin)
    // ==========================================
    if (path.startsWith('/admin') && roleName !== 'Admin') {
      url.pathname = '/feed';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};