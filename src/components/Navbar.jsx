import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, Shield, LogOut, Star, Menu, X } from 'lucide-react';
import { getCustomer, clearCustomer, isAdmin, clearAdmin, invokeCustomer, invokePublic, getAdminSessionToken } from '@/lib/customerAuth';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const customer = getCustomer();
  const admin = isAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await invokeCustomer('logoutCustomer');
    } catch (_e) { /* ignore */ }
    clearCustomer();
    if (getAdminSessionToken()) {
      try { await invokePublic('logoutCustomer', { session_token: getAdminSessionToken() }); } catch (_e) { /* ignore */ }
    }
    clearAdmin();
    navigate('/');
    window.location.reload();
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground rounded-xl p-2">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">
            Win<span className="text-primary">Win</span>.leb
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm">Shop</Button>
          </Link>
          <Link to="/winwin-card">
            <Button variant="ghost" size="sm" className="text-primary">
              <Star className="w-4 h-4 mr-1" /> WinWin Card
            </Button>
          </Link>
          {customer ? (
            <>
              <Link to="/my-account">
                <Button variant="ghost" size="sm">
                  <User className="w-4 h-4 mr-1" /> {customer.full_name?.split(' ')[0]}
                  <span className="ml-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {customer.points || 0} pts
                  </span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
          <Link to="/admin-login">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
              <Shield className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-2">
          <Link to="/" onClick={() => setMobileOpen(false)}>
            <Button variant="ghost" className="w-full justify-start">Shop</Button>
          </Link>
          <Link to="/winwin-card" onClick={() => setMobileOpen(false)}>
            <Button variant="ghost" className="w-full justify-start text-primary">
              <Star className="w-4 h-4 mr-2" /> WinWin Card
            </Button>
          </Link>
          {customer ? (
            <>
              <Link to="/my-account" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  <User className="w-4 h-4 mr-2" /> My Account ({customer.points || 0} pts)
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Sign In</Button>
            </Link>
          )}
          <Link to="/admin-login" onClick={() => setMobileOpen(false)}>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground">
              <Shield className="w-4 h-4 mr-2" /> Admin
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
}