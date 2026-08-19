'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export function useAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.me()
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const logout = async () => {
    await api.logout().catch(() => {});
    router.replace('/login');
  };

  return { loading, user, logout };
}
