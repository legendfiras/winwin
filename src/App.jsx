import { lazy, Suspense } from 'react';
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

const Auth = lazy(() => import('@/pages/Auth'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const RecoverAccount = lazy(() => import('@/pages/RecoverAccount'));
const ReviewProfile = lazy(() => import('@/pages/ReviewProfile'));
const MyAccount = lazy(() => import('@/pages/MyAccount'));
const WinWinCard = lazy(() => import('@/pages/WinWinCard'));
const AdminLogin = lazy(() => import('@/pages/AdminLogin'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'));
const AdminWinWinCardPage = lazy(() => import('@/pages/admin/AdminWinWinCard'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminQRCode = lazy(() => import('@/pages/admin/AdminQRCode'));
const AdminPendingTransactions = lazy(() => import('@/pages/admin/AdminPendingTransactions'));
const AdminRecovery = lazy(() => import('@/pages/admin/AdminRecovery'));
const AdminLoyalty = lazy(() => import('@/pages/admin/AdminLoyalty'));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
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
        <Route path="/admin/customers" element={<AdminCustomers />} />
        <Route path="/admin/winwin-card" element={<AdminWinWinCardPage />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/qrcode" element={<AdminQRCode />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
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
        <SonnerToaster position="top-center" richColors offset={72} />
      </CartProvider>
    </QueryClientProvider>
  )
}

export default App
