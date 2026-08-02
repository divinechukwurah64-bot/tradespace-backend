'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

 useEffect(() => {
  setMounted(true);
  checkUser();
}, []);

  const checkUser = () => {
    const userData = localStorage.getItem('user');
    setUser(userData ? JSON.parse(userData) : null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/');
  };

  if (!mounted) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl md:text-2xl text-blue-600">
            TradeSpace
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/auctions" className="text-gray-700 hover:text-blue-600 font-medium text-sm md:text-base">
              Auctions
            </Link>
            <Link href="/clear-space" className="text-gray-700 hover:text-blue-600 font-medium text-sm md:text-base">
              Clear Space
            </Link>
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/profile" className="flex items-center gap-2 text-gray-700 hover:text-blue-600">
                  <User className="w-5 h-5" />
                  <span className="font-medium text-sm">{user.fullName}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-gray-700 hover:text-blue-600 font-medium text-sm">
                  Sign In
                </Link>
                <Link href="/register" className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm">
                  Join
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-gray-700"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-4">
            <Link href="/auctions" className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
              Auctions
            </Link>
            <Link href="/clear-space" className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
              Clear Space
            </Link>

            {user ? (
              <>
                <Link href="/profile" className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
                  Sign In
                </Link>
                <Link href="/register" className="block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm text-center">
                  Join Free
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}