import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Settings, Users, LogOut, LayoutDashboard, CreditCard, QrCode, ClipboardList, Award, LifeBuoy, Menu } from 'lucide-react';
import { isAdmin, clearAdmin } from '@/lib/customerAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import BrandLogo from '@/components/BrandLogo';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/pending', label: 'Orders', icon: ClipboardList },
  { path: '/admin/recovery', label: 'Account Recovery', icon: LifeBuoy },
  { path: '/admin/loyalty', label: 'Loyalty', icon: Award },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/customers', label: 'Customers', icon: Users },
  { path: '/admin/winwin-card', label: 'WinWin Card', icon: CreditCard },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
  { path: '/admin/qrcode', label: 'QR Code', icon: QrCode },
];

function NavLinks({ pathname, onNavigate, className = '' }) {
  return (
    <nav className={className}>
      {NAV_ITEMS.map((item) => {
        const active = item.path === '/admin'
          ? pathname === '/admin'
          : pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <Link key={item.path} to={item.path} onClick={onNavigate}>
            <Button
              variant={active ? 'default' : 'ghost'}
              className="h-11 w-full justify-start gap-2 text-sm"
              size="sm"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isAdmin()) navigate('/admin-login');
  }, []);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!isAdmin()) return null;

  const exitAdmin = () => {
    clearAdmin();
    navigate('/');
  };

  return (
    <div className="flex min-h-dvh bg-muted">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border p-4">
          <Link to="/" className="block">
            <BrandLogo className="h-12" />
          </Link>
          <p className="mt-2 font-heading text-sm font-semibold text-foreground">Admin</p>
        </div>
        <NavLinks pathname={location.pathname} className="flex-1 space-y-1 overflow-y-auto p-4" />
        <div className="border-t border-border p-4">
          <Button
            variant="ghost"
            className="h-11 w-full justify-start gap-2 text-destructive"
            size="sm"
            onClick={exitAdmin}
          >
            <LogOut className="h-4 w-4" /> Exit Admin
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-3 py-3 backdrop-blur md:hidden">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => setMenuOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex min-w-0 items-center">
            <BrandLogo className="h-9" />
          </Link>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={exitAdmin} aria-label="Exit admin">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="flex w-[min(100%,20rem)] flex-col p-0">
            <SheetHeader className="border-b border-border p-4 text-left">
              <SheetTitle className="font-heading">Admin menu</SheetTitle>
            </SheetHeader>
            <NavLinks
              pathname={location.pathname}
              onNavigate={() => setMenuOpen(false)}
              className="flex-1 space-y-1 overflow-y-auto p-4"
            />
            <div className="border-t border-border p-4">
              <Button
                variant="ghost"
                className="h-11 w-full justify-start gap-2 text-destructive"
                onClick={exitAdmin}
              >
                <LogOut className="h-4 w-4" /> Exit Admin
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-x-hidden p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
