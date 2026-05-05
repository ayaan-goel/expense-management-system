'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManagerRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the actual manager dashboard
    router.replace('/dashboard/manager');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Redirecting...</h2>
        <p className="text-gray-600">Taking you to the manager dashboard</p>
      </div>
    </div>
  );
}