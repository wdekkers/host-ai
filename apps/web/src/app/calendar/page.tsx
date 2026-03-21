import { getAuthContext } from '@/lib/auth/get-auth-context';
import { CalendarView } from './CalendarView';

export default async function CalendarPage() {
  const auth = await getAuthContext();
  return <CalendarView showRates={auth?.role === 'owner'} />;
}
