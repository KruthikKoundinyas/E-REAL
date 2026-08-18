'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.replace('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
          E-REAL
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Dashboard
          </Link>
          <Link href="/compose" className="text-sm text-gray-600 hover:text-gray-900">
            Compose
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
