import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Settings, Users, LogOut, LayoutDashboard, ClipboardList, Award, LifeBuoy, Menu } from 'lucide-react';
import { isAdmin, clearAdmin, invokeAdmin } from '@/lib/customerAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import BrandLogo from '@/components/BrandLogo';

const NAV_ITEMS = [
  { path: '/admin/pending', label: 'Orders', icon: ClipboardList, badge: 'pending_orders' },
  { path: '/admin/customers', label: 'Users', icon: Users },
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/loyalty', label: 'Loyalty', icon: Award },
  { path: '/admin/recovery', label: 'Recovery', icon: LifeBuoy, badge: 'pending_recovery' },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

function NavLinks({ pathname, onNavigate, counts, className = '' }) {
  return (
    <nav className={className}>
      {NAV_ITEMS.map((item) => {
        const active = item.path === '/admin'
          ? pathname === '/admin'
          : pathname === item.path || pathname.startsWith(`${item.path}/`);
        const count = item.badge ? Number(counts?.[item.badge]) || 0 : 0;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${active ? 'bg-[#FAF6EF] text-[#7A1528]' : 'text-[#FAF6EF] hover:bg-white/10'}`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {count > 0 && (
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-[#C7952E] text-white' : 'bg-[#C7952E] text-white'}`}>
                {count}
              </span>
            )}
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
  const { data: stats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await invokeAdmin('adminStats');
      return res?.error ? null : res;
    },
    refetchInterval: 30000,
  });

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
    <div className="flex min-h-dvh bg-[#F3EBE0]">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#7A1528] text-[#FAF6EF] md:flex">
        <div className="p-4">
          <Link to="/" className="block rounded-xl bg-[#FAF6EF] p-3">
            <BrandLogo className="h-12" />
          </Link>
          <p className="mt-3 font-heading text-sm font-semibold">WinWin desk</p>
        </div>
        <NavLinks pathname={location.pathname} counts={stats} className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" />
        <div className="p-3">
          <Button
            variant="ghost"
            className="h-11 w-full justify-start gap-2 text-[#FAF6EF] hover:bg-white/10 hover:text-white"
            size="sm"
            onClick={exitAdmin}
          >
            <LogOut className="h-4 w-4" /> Exit Admin
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-[#7A1528] px-3 py-3 text-[#FAF6EF] md:hidden">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 border-white/20 bg-transparent text-[#FAF6EF] hover:bg-white/10"
            onClick={() => setMenuOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex min-w-0 items-center rounded-lg bg-[#FAF6EF] px-3 py-1">
            <BrandLogo className="h-9" />
          </Link>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-[#FAF6EF] hover:bg-white/10" onClick={exitAdmin} aria-label="Exit admin">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="flex w-[min(100%,20rem)] flex-col border-0 bg-[#7A1528] p-0 text-[#FAF6EF]">
            <SheetHeader className="p-4 text-left">
              <SheetTitle className="font-heading text-[#FAF6EF]">WinWin desk</SheetTitle>
            </SheetHeader>
            <NavLinks
              pathname={location.pathname}
              counts={stats}
              onNavigate={() => setMenuOpen(false)}
              className="flex-1 space-y-1 overflow-y-auto px-3"
            />
            <div className="p-3">
              <Button
                variant="ghost"
                className="h-11 w-full justify-start gap-2 text-[#FAF6EF] hover:bg-white/10"
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
