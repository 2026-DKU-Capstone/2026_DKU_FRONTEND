'use client';

import { useRouter } from 'next/navigation';
import FormSelectScreen from '@/screens/FormSelectScreen';

export default function Page() {
  const router = useRouter();
  return (
    <FormSelectScreen
      onNext={() => router.push('/doc-review')}
      onPrev={() => router.push('/receipt')}
    />
  );
}
