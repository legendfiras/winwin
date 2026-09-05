import { isCardActive } from '@/lib/customerAuth';

function formatExpiry(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split('T')[0];
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function getMembershipUi(customer) {
  if (!customer) {
    return {
      status: 'guest',
      kicker: 'WinWin Card',
      title: 'Save more every time you shop.',
      cta: 'Get WinWin Card',
      href: '/winwin-card',
    };
  }

  if (customer.card_pending || customer.membership_status === 'PENDING') {
    return {
      status: 'pending',
      kicker: 'WinWin Card',
      title: 'Membership request pending',
      cta: 'View WinWin Card',
      href: '/winwin-card',
    };
  }

  const active = isCardActive(customer);
  const expiry = formatExpiry(customer.card_expiry_date);

  if (active && customer.card_expiring_soon) {
    const days = customer.card_days_left;
    const soon =
      typeof days === 'number'
        ? `Expires in ${days} day${days === 1 ? '' : 's'}`
        : 'Membership expires soon';
    return {
      status: 'expiring',
      kicker: 'WinWin Card',
      title: soon,
      expiry,
      cta: 'Renew WinWin Card',
      href: '/winwin-card',
    };
  }

  if (active) {
    return {
      status: 'active',
      kicker: 'WinWin Card Active',
      title: 'Your member prices are on.',
      expiry,
      cta: 'View membership',
      href: '/winwin-card',
    };
  }

  if (customer.card_expired || (customer.has_winwin_card && !active)) {
    return {
      status: 'expired',
      kicker: 'WinWin Card',
      title: 'Your membership has expired.',
      expiry,
      cta: 'Renew WinWin Card',
      href: '/winwin-card',
    };
  }

  return {
    status: 'none',
    kicker: 'WinWin Card',
    title: 'Save more every time you shop.',
    cta: 'Become a WinWin Member',
    href: '/winwin-card',
  };
}
