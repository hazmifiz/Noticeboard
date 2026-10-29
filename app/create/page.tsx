import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import CreateAnnouncementForm from './CreateFormUI';

export interface Category {
  id: string;
  name: string;
}

export default async function CreateAnnouncementPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Fetch active categories for the selector dropdown
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true);

  return (
    <main class="max-w-2xl w-full mx-auto px-6 py-8">
      <CreateAnnouncementForm categories={categories || []} />
    </main>
  );
}