'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createAnnouncement(formData: FormData) {
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

  // 1. Gate 1: Check Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // 2. Gate 3: Verify Publisher or Admin Role
  const { data: userData } = await supabase
    .from('users')
    .select('roles(role_name)')
    .eq('id', user.id)
    .single();

  // @ts-ignore
  const roleName = userData?.roles?.role_name;
  if (roleName !== 'Publisher' && roleName !== 'Admin') {
    throw new Error('Forbidden: Only Publishers and Admins can create announcements.');
  }

  // Extract Form Fields
  const title = formData.get('title') as string;
  const body = formData.get('body') as string;
  const categoryId = formData.get('categoryId') as string;
  const isUrgent = formData.get('isUrgent') === 'on';
  const file = formData.get('attachment') as File | null;

  let attachmentUrl: string | null = null;

  // 3. Upload File Attachment to Supabase Storage (if attached)
  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError.message);
      throw new Error('Failed to upload file attachment.');
    }

    const { data: publicUrlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(filePath);

    attachmentUrl = publicUrlData.publicUrl;
  }

  // 4. Insert Record into announcements table
  const { data: announcement, error: insertError } = await supabase
    .from('announcements')
    .insert({
      title,
      body,
      publisher_id: user.id,
      is_urgent: isUrgent,
      attachment_url: attachmentUrl,
    })
    .select('id')
    .single();

  if (insertError || !announcement) {
    console.error('Database Insert Error:', insertError?.message);
    throw new Error('Failed to create announcement.');
  }

  // 5. Map Category in announcement_categories join table
  if (categoryId) {
    await supabase.from('announcement_categories').insert({
      announcement_id: announcement.id,
      category_id: categoryId,
    });
  }

  // 6. Redirect back to Feed upon completion
  redirect('/feed');
}