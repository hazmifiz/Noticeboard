'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    // Enforce college domain before sending
    if (!email.endsWith('@beranang.kpm.edu.my')) {
      setStatus('error');
      return;
    }

      const redirectUrl =
        `${window.location.origin}/auth/callback`;

      console.log('Requested callback:', redirectUrl);

    console.log(
      'Requested redirect URL:',
      `${window.location.origin}/auth/callback`
    );

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });


    if (error) {
      console.error('OTP error:', error.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Campus Noticeboard System</h1>
        
        {status === 'sent' ? (
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-sm">
            Check your institutional email ({email}) for the secure login link.
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4 pt-4">
            <input
              type="email"
              placeholder="student@beranang.kpm.edu.my"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-slate-500 w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 px-4 rounded-xl transition-all disabled:opacity-50"
            >
              {status === 'loading' ? 'Sending...' : 'Send Magic Link'}
            </button>
            {status === 'error' && (
              <p className="text-xs text-red-600">Please use a valid institutional email address.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}