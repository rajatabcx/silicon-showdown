import { notFound } from 'next/navigation';
import { DevLab } from '@/src/game/ui/DevLab';

export const metadata = { title: 'Move Lab · Silicon Showdown' };

/** Dev only: a lab to fire every signature, Policy Move and Super, at Average Joe or a billionaire. 404 in production. */
export default function Dev() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DevLab />;
}
