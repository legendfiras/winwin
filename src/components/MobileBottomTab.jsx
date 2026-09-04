import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Star, User } from 'lucide-react';

const SCROLL_KEY = 'tab_scroll_positions';
const FILTER_KEY = 'tab_filter_states';

const TABS = [
  { path: '/', label: 'Shop', icon: Home },
  { path: '/winwin-card', label: 'WinWin Card', icon: Star },
  { path: '/my-account', label: 'Account', icon: User },
];

function saveScrollPos(path) {
  try {
    const positions = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}');
    positions[path] = window.scrollY;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(positions));
  } catch {}
}

function restoreScrollPos(path) {
  try {
    const positions = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}');
    if (positions[path] !== undefined) {
      setTimeout(() => window.scrollTo({ top: positions[path], behavior: 'instant' }), 0);
    }
  } catch {}
}

export default function MobileBottomTab() {
  const location = useLocation();
  const navigate = useNavigate();

  // Save scroll position on route change
  useEffect(() => {
    const prevPath = sessionStorage.getItem('_prev_tab_path');
    if (prevPath && prevPath !== location.pathname) {
      saveScrollPos(prevPath);
    }
    sessionStorage.setItem('_prev_tab_path', location.pathname);
  }, [location.pathname]);

  // Restore scroll position on mount
  useEffect(() => {
    restoreScrollPos(location.pathname);
  }, []);

  const handleTabClick = (e, tab) => {
    const isActive = location.pathname === tab.path;
    if (isActive) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      saveScrollPos(location.pathname);
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {TABS.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={(e) => handleTabClick(e, tab)}
              className={`flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] px-3 py-1 rounded-xl transition-colors select-none ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${isActive ? 'fill-primary/10' : ''}`} />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}