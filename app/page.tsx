import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirects all root traffic to the feed.
  // Your existing Middleware will automatically catch unauthenticated users 
  // and bounce them to /login.
  redirect('/feed');
}