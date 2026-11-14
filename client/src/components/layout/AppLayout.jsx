import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  LayoutDashboard,
  Pill,
  Boxes,
  Truck,
  ShoppingCart,
  Package,
  UserCheck,
  Users,
  FileText,
  Receipt,
  TrendingUp,
  CreditCard,
  RotateCcw,
  BarChart3,
  History,
  Bell,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { toggleSidebar, toggleMobileMenu, setMobileMenuOpen } from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { isSidebarOpen, isMobileMenuOpen } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');

  const handleHeaderSearch = (e) => {
    if (e.key === 'Enter' && headerSearch.trim()) {
      navigate(`/medicines?search=${encodeURIComponent(headerSearch.trim())}`);
    }
  };

  // Grouped Navigation matching Section 18
  const navSections = [
    {
      group: 'Core Pharmacy',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Medicines', href: '/medicines', icon: Pill },
        { name: 'Customer Orders', href: '/orders', icon: Package },
        { name: 'Inventory & Batches', href: '/inventory', icon: Boxes },
        { name: 'Prescription Oversight', href: '/prescriptions', icon: FileText },
      ],
    },
    {
      group: 'Supply & Procurement',
      items: [
        { name: 'Suppliers', href: '/suppliers', icon: Truck },
        { name: 'Purchases & Orders', href: '/purchases', icon: ShoppingCart },
      ],
    },
    {
      group: 'Sales & Invoices',
      items: [
        { name: 'Sales & Invoices', href: '/sales', icon: Receipt },
        { name: 'Returns & Refunds', href: '/returns', icon: RotateCcw },
      ],
    },
    {
      group: 'Staff & Accounts',
      items: [
        { name: 'Employees', href: '/employees', icon: UserCheck },
        { name: 'User Management', href: '/users', icon: Users },
      ],
    },
    {
      group: 'Financial Governance',
      items: [
        { name: 'Financial Management', href: '/finance', icon: TrendingUp },
        { name: 'Expenses', href: '/expenses', icon: CreditCard },
        { name: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
      ],
    },
    {
      group: 'System & Security',
      items: [
        { name: 'Audit Logs', href: '/audit-logs', icon: History },
        { name: 'Notifications', href: '/notifications', icon: Bell },
        { name: 'Settings', href: '/settings', icon: Settings },
        { name: 'My Profile', href: '/profile', icon: User },
      ],
    },
  ];

  const userRole = user?.role || 'admin';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => dispatch(setMobileMenuOpen(false))}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-200 transition-all duration-300 ease-in-out lg:static',
          isSidebarOpen ? 'w-64' : 'w-20',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 flex-shrink-0">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-slate-950 text-xl shadow-md flex-shrink-0">
              M+
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-white leading-none">
                  MediStock
                </span>
                <span className="text-[10px] tracking-wider uppercase text-teal-400 font-semibold mt-1">
                  Enterprise ERP
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => dispatch(toggleMobileMenu())}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Grouped) */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navSections.map((sec, secIdx) => (
            <div key={sec.group || secIdx} className="space-y-1">
              {isSidebarOpen && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {sec.group}
                </div>
              )}
              {sec.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    )}
                    title={!isSidebarOpen ? item.name : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {isSidebarOpen && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Quick Sign Out in Sidebar */}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              title={!isSidebarOpen ? 'Logout' : undefined}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {isSidebarOpen && <span>Sign Out</span>}
            </button>
          </div>
        </nav>

        {/* Current Role Indicator */}
        {isSidebarOpen && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Panel: <span className="text-teal-300 font-bold">Admin Portal</span>
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 hidden lg:flex"
              title="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => dispatch(toggleMobileMenu())}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Medicine Search Bar */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-slate-500 w-64 md:w-80">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={handleHeaderSearch}
                placeholder="Search medicines (press Enter)..."
                className="bg-transparent border-none text-sm focus:outline-none w-full text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Link to Notifications */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="System Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"></span>
            </Link>

            {/* User Profile Pill & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-slate-900 text-teal-400 flex items-center justify-center text-xs font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-tight">
                    {user?.name || 'Administrator'}
                  </span>
                  <span className="text-[10px] text-teal-600 uppercase font-bold tracking-wider">
                    Superadmin
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{user?.name || 'Administrator'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@medistock.com'}</p>
                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                      Role: Admin
                    </span>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Admin Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    System Settings
                  </Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left font-medium"
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
