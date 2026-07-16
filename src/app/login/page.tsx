import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return <LoginForm />;
}
