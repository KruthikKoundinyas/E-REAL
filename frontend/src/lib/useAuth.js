'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
    } else {
      setLoading(false);
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  return { loading, logout };
}
