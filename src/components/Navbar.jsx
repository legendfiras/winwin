import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Shield, User } from 'lucide-react';
import { getCustomer, clearCustomer, isAdmin, clearAdmin, invokeCustomer, invokePublic, getAdminSessionToken } from '@/lib/customerAuth';
import { formatPoints } from '@/lib/pointsTiers';
import { PRIMARY_CATEGORIES, MORE_CATEGORIES } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import CartButton from '@/components/CartButton';
import HeaderSearch from '@/components/HeaderSearch';
import BrandLogo from '@/components/BrandLogo';
import Container from '@/components/Container';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex h-10 shrink-0 items-center rounded-[10px] px-2.5 text-sm font-medium text-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-11 lg:px-3"
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const customer = getCustomer();
  const admin = isAdmin();
  const navigate = useNavigate();
  const firstName = customer?.full_name?.split(' ')[0] || 'Account';

  const handleLogout = async () => {
    try {
      await invokeCustomer('logoutCustomer');
    } catch {
      /* ignore */
    }
    clearCustomer();
    if (getAdminSessionToken()) {
      try { await invokePublic('logoutCustomer', { session_token: getAdminSessionToken() }); } catch { /* ignore */ }
    }
    clearAdmin();
    navigate('/');
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-50 isolate border-b border-[rgba(201,176,130,0.22)] bg-[#FBF8F2]">
      <Container className="relative flex h-16 items-center gap-2 md:h-[4.25rem] md:gap-3 lg:gap-5">
        <Link to="/" className="relative z-10 shrink-0 overflow-hidden" aria-label="WinWin home">
          <BrandLogo />
        </Link>

        <nav className="relative z-10 hidden min-w-0 flex-1 items-center md:flex" aria-label="Primary">
          <NavLink to="/">Shop</NavLink>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 shrink-0 rounded-[10px] px-2.5 text-sm font-medium lg:h-11 lg:px-3">
                Categories
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="z-[60] w-56">
              {PRIMARY_CATEGORIES.map((item) => (
                <DropdownMenuItem key={item.key} asChild>
                  <Link to={`/?cat=${item.key}`}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {MORE_CATEGORIES.filter((item) => ['new_gadgets', 'must_have'].includes(item.key)).map((item) => (
                <DropdownMenuItem key={item.key} asChild>
                  <Link to={`/?cat=${item.key}`}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <NavLink to="/winwin-card">WinWin Card</NavLink>
        </nav>

        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1">
          <HeaderSearch />
          {customer ? (
            <span className="hidden items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground xl:inline-flex">
              {formatPoints(customer.points)}
            </span>
          ) : null}
          <CartButton />
          {customer ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden h-10 max-w-[9.5rem] rounded-[10px] px-2.5 md:inline-flex lg:h-11 lg:px-3">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">{firstName}</span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[60] w-52">
                <DropdownMenuItem asChild>
                  <Link to="/my-account">Account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/winwin-card">WinWin Card</Link>
                </DropdownMenuItem>
                {admin ? (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="hidden h-10 rounded-[10px] md:inline-flex">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </Container>
    </header>
  );
}
