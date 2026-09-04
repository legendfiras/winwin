import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Image, Settings, Users, LogOut, LayoutDashboard, CreditCard, QrCode, ClipboardList, Award } from 'lucide-react';
import { isAdmin, clearAdmin } from '@/lib/customerAuth';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/pending', label: 'Pending', icon: ClipboardList },
  { path: '/admin/loyalty', label: 'Loyalty', icon: Award },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/slideshow', label: 'Slideshow', icon: Image },
  { path: '/admin/customers', label: 'Customers', icon: Users },
  { path: '/admin/winwin-card', label: 'WinWin Card', icon: CreditCard },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
  { path: '/admin/qrcode', label: 'QR Code', icon: QrCode },
];

export default function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isAdmin()) navigate('/admin-login');
  }, []);

  if (!isAdmin()) return null;

  return (
    <div className="min-h-screen bg-muted flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="font-heading font-bold text-xl">
            Win<span className="text-primary">Win</span> Admin
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={location.pathname === item.path ? 'default' : 'ghost'}
                className="w-full justify-start gap-2"
                size="sm"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive"
            size="sm"
            onClick={() => { clearAdmin(); navigate('/'); }}
          >
            <LogOut className="w-4 h-4" /> Exit Admin
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden bg-card border-b border-border p-4 flex items-center justify-between">
          <h1 className="font-heading font-bold text-lg">
            Win<span className="text-primary">Win</span> Admin
          </h1>
          <Button variant="ghost" size="sm" onClick={() => { clearAdmin(); navigate('/'); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </header>
        {/* Mobile nav */}
        <div className="md:hidden flex overflow-x-auto gap-1 p-2 bg-card border-b border-border">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={location.pathname === item.path ? 'default' : 'ghost'}
                size="sm"
                className="whitespace-nowrap text-xs gap-1"
              >
                <item.icon className="w-3 h-3" />
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}