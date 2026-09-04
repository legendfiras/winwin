import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';

import Home from '@/pages/Home';
import Auth from '@/pages/Auth';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
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
import AdminLoyalty from '@/pages/admin/AdminLoyalty';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -60 }}
        transition={{ type: 'tween', ease: 'easeInOut', duration: 0.22 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/my-account" element={<MyAccount />} />
          <Route path="/winwin-card" element={<WinWinCard />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/pending" element={<AdminPendingTransactions />} />
          <Route path="/admin/loyalty" element={<AdminLoyalty />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/slideshow" element={<AdminSlideshow />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/winwin-card" element={<AdminWinWinCardPage />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/qrcode" element={<AdminQRCode />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AnimatedRoutes />
      </Router>
      <Toaster />
      <SonnerToaster position="top-center" richColors />
    </QueryClientProvider>
  )
}

export default App