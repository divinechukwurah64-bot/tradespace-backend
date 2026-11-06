'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, User, MessageCircle } from 'lucide-react';
import API from '@/lib/api';
import DialogHost from './DialogHost';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    setMounted(true);
    checkUser();
  }, []);

  // Closes the mobile menu whenever the page changes, whatever was tapped
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // How many sellers are live right now. Pauses while the tab is hidden.
  useEffect(() => {
    let cancelled = false;

    const loadCount = async () => {
      if (document.hidden) return;
      try {
        const res = await API.get('/live/count');
        if (!cancelled) setLiveCount(Number(res.data.count) || 0);
      } catch (err) {
        // the count just stays as it was
      }
    };

    loadCount();
    const timer = setInterval(loadCount, 30000);
    const onVisible = () => {
      if (!document.hidden) loadCount();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // How many unread messages I have. Only when logged in, and pauses while the tab is hidden.
  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }

    let cancelled = false;

    const loadUnread = async () => {
      if (document.hidden) return;
      try {
        const res = await API.get('/messages/unread-count');
        if (!cancelled) setUnreadMessages(Number(res.data.count) || 0);
      } catch (err) {
        // the count just stays as it was
      }
    };

    loadUnread();
    const timer = setInterval(loadUnread, 30000);
    const onVisible = () => {
      if (!document.hidden) loadUnread();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  const checkUser = () => {
    try {
      const userData = localStorage.getItem('user');
      setUser(userData ? JSON.parse(userData) : null);
    } catch (err) {
      setUser(null);
    }
  };

  const closeMenu = () => setIsOpen(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsOpen(false);
    window.location.href = '/login';
  };

  if (!mounted) return null;

  const isLive = liveCount > 0;
  const unreadLabel = unreadMessages > 99 ? '99+' : String(unreadMessages);

  return (
    <>
      <DialogHost />
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">

            {/* Logo */}
            <Link
              href="/"
              onClick={closeMenu}
              className="flex items-center gap-2 font-bold text-xl md:text-2xl text-blue-600"
            >
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
            <div className="flex items-center gap-3">
              <Link
                href="/live"
                onClick={closeMenu}
                className={
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ' +
                  (isLive
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }
              >
                <span
                  className={
                    'w-2 h-2 rounded-full ' + (isLive ? 'bg-white animate-pulse' : 'bg-gray-400')
                  }
                />
                Live{isLive ? ` ${liveCount}` : ''}
              </Link>

              {user && (
                <Link
                  href="/messages"
                  onClick={closeMenu}
                  className="relative p-2 text-gray-700 hover:text-blue-600"
                  title="Messages"
                  aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadLabel}
                    </span>
                  )}
                </Link>
              )}

              {user && <NotificationBell />}

              <div className="hidden md:flex items-center gap-4">
                {user ? (
                  <div className="flex items-center gap-4">
                    <Link href="/profile" className="flex items-center gap-2 text-gray-700 hover:text-blue-600">
                      {user.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt={user.fullName}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
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
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isOpen && (
            <div className="md:hidden pb-4 space-y-4">
              <Link href="/auctions" onClick={closeMenu} className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
                Auctions
              </Link>
              <Link href="/clear-space" onClick={closeMenu} className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
                Clear Space
              </Link>

              {user ? (
                <>
                  <Link href="/messages" onClick={closeMenu} className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
                    Messages{unreadMessages > 0 ? ` (${unreadLabel})` : ''}
                  </Link>
                  <Link href="/profile" onClick={closeMenu} className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
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
                  <Link href="/login" onClick={closeMenu} className="block text-gray-700 hover:text-blue-600 font-medium text-sm">
                    Sign In
                  </Link>
                  <Link href="/register" onClick={closeMenu} className="block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm text-center">
                    Join Free
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}