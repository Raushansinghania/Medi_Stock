import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  LayoutDashboard,
  FileCheck2,
  Package,
  Receipt,
  Pill,
  Boxes,
  Layers,
  ClockAlert,
  Users,
  FileText,
  RotateCcw,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Search,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { logout } from '@/store/slices/authSlice';
import { cn } from '@/lib/utils';

export default function PharmacistLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  // Fetch live dashboard metrics for badges (pending prescriptions, near expiry, low stock)
  const { data: dashData } = useQuery({
    queryKey: ['pharmacist-dashboard-badges'],
    queryFn: async () => {
      const res = await api.get('/pharmacist/dashboard');
      return res.data;
    },
    refetchInterval: 30000, // refresh every 30s
  });

  const stats = dashData?.stats || {};
  const pendingRxCount = stats.pendingPrescriptions || 0;
  const nearExpiryCount = stats.nearExpiryCount || 0;
  const lowStockCount = stats.lowStockCount || 0;

  const navigation = [
    { name: 'Dashboard', href: '/pharmacist', icon: LayoutDashboard },
    {
      name: 'Prescription Verification',
      href: '/pharmacist/prescriptions',
      icon: FileCheck2,
      badge: pendingRxCount > 0 ? pendingRxCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    { name: 'Customer Orders', href: '/pharmacist/orders', icon: Package },
    { name: 'POS Billing', href: '/pharmacist/pos', icon: Receipt },
    { name: 'Medicine Catalogue', href: '/pharmacist/medicines', icon: Pill },
    {
      name: 'Inventory & Batches',
      href: '/pharmacist/inventory',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    { name: 'FEFO Dispensing', href: '/pharmacist/fefo', icon: Layers },
    {
      name: 'Expiry Monitoring',
      href: '/pharmacist/expiry',
      icon: ClockAlert,
      badge: nearExpiryCount > 0 ? nearExpiryCount : null,
      badgeColor: 'bg-red-600 text-white',
    },
    { name: 'Customers', href: '/pharmacist/customers', icon: Users },
    { name: 'Sales & Invoices', href: '/pharmacist/sales', icon: FileText },
    { name: 'Returns & Inspection', href: '/pharmacist/returns', icon: RotateCcw },
    { name: 'Notifications', href: '/pharmacist/notifications', icon: Bell },
    { name: 'My Profile', href: '/pharmacist/profile', icon: User },
  ];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleQuickSearch = (e) => {
    if (e.key === 'Enter' && quickSearch.trim()) {
      navigate(`/pharmacist/medicines?search=${encodeURIComponent(quickSearch.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Pharmacist Clinical Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-200 transition-all duration-300 ease-in-out lg:static border-r border-slate-800',
          sidebarOpen ? 'w-64' : 'w-20',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header with Medical Teal Accent */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/40">
          <Link to="/pharmacist" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-bold text-lg shadow-md flex-shrink-0">
              Rx
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white leading-tight">
                  MediStock
                </span>
                <span className="text-[10px] tracking-wider uppercase text-teal-400 font-semibold">
                  Pharmacist Panel
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clinical Quick Status Pill */}
        {sidebarOpen && (
          <div className="px-4 py-2.5 bg-teal-950/40 border-b border-teal-900/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-teal-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium">Pharmacy Active</span>
            </div>
            <span className="text-[10px] text-teal-400/80 uppercase font-mono">FEFO Mode</span>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navigation.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== '/pharmacist' && location.pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                )}
                title={!sidebarOpen ? item.name : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.name}</span>}
                </div>
                {sidebarOpen && item.badge && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold',
                      item.badgeColor || 'bg-teal-500 text-slate-950'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pharmacist License Badge */}
        {sidebarOpen && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-teal-400">Licensed Pharmacist</span>
                <span className="text-[11px] text-slate-300 truncate">{user?.name || 'Lead Pharmacist'}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 hidden lg:flex"
              title="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
              title="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Medicine Search Input */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-slate-500 w-64 md:w-80">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                onKeyDown={handleQuickSearch}
                placeholder="Search medicines or batches (Enter)..."
                className="bg-transparent border-none text-xs sm:text-sm focus:outline-none w-full text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Action: POS Billing shortcut */}
            <Link
              to="/pharmacist/pos"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              New POS Bill
            </Link>

            {/* Pending Prescriptions Warning Trigger */}
            <Link
              to="/pharmacist/prescriptions"
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Prescription Verification Queue"
            >
              <FileCheck2 className="w-5 h-5" />
              {pendingRxCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {pendingRxCount}
                </span>
              )}
            </Link>

            {/* Notifications Trigger */}
            <Link
              to="/pharmacist/notifications"
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {nearExpiryCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
              )}
            </Link>

            {/* Pharmacist Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-tight">
                    {user?.name || 'Pharmacist'}
                  </span>
                  <span className="text-[10px] text-teal-600 uppercase font-semibold">
                    Pharmacist
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{user?.name || 'Pharmacist'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email || 'pharmacist@medistock.com'}</p>
                  </div>
                  <Link
                    to="/pharmacist/profile"
                    className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    My Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 text-left font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
