import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';

import { CartProvider } from '@/lib/cart';
import CartDrawer from '@/components/CartDrawer';
import CheckoutDialog from '@/components/CheckoutDialog';
import Home from '@/pages/Home';
import Product from '@/pages/Product';
import Cart from '@/pages/Cart';
import Auth from '@/pages/Auth';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import VerifyEmail from '@/pages/VerifyEmail';
import RecoverAccount from '@/pages/RecoverAccount';
import ReviewProfile from '@/pages/ReviewProfile';
import MyAccount from '@/pages/MyAccount';
import WinWinCard from '@/pages/WinWinCard';
import AdminLogin from '@/pages/AdminLogin';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminProducts from '@/pages/admin/AdminProducts';
import AdminSlideshow from '@/pages/admin/AdminSlideshow';
import AdminCustomers from '@/pages/admin/AdminCustomers';
import AdminWinWinCardPage from '@/pages/admin/AdminWinWinCard';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminQRCode from '@/pages/admin/AdminQRCode';
import AdminPendingTransactions from '@/pages/admin/AdminPendingTransactions';
import AdminRecovery from '@/pages/admin/AdminRecovery';
import AdminLoyalty from '@/pages/admin/AdminLoyalty';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/product/:id" element={<Product />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/recover-account" element={<RecoverAccount />} />
      <Route path="/review-profile" element={<ReviewProfile />} />
      <Route path="/my-account" element={<MyAccount />} />
      <Route path="/winwin-card" element={<WinWinCard />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/pending" element={<AdminPendingTransactions />} />
      <Route path="/admin/recovery" element={<AdminRecovery />} />
      <Route path="/admin/loyalty" element={<AdminLoyalty />} />
      <Route path="/admin/products" element={<AdminProducts />} />
      <Route path="/admin/slideshow" element={<AdminSlideshow />} />
      <Route path="/admin/customers" element={<AdminCustomers />} />
      <Route path="/admin/winwin-card" element={<AdminWinWinCardPage />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      <Route path="/admin/qrcode" element={<AdminQRCode />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <CartProvider>
        <Router>
          <AppRoutes />
          <CartDrawer />
          <CheckoutDialog />
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </CartProvider>
    </QueryClientProvider>
  )
}

export default App
