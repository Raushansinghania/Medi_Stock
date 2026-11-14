import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  LayoutDashboard,
  Pill,
  Search,
  UploadCloud,
  FileText,
  ShoppingCart,
  Package,
  Compass,
  Receipt,
  CreditCard,
  User,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { logout } from '@/store/slices/authSlice';
import { cn } from '@/lib/utils';

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.auth);
  const cartItems = useSelector((state) => state.cart?.items || []);
  const cartCount = cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Search state & debouncing
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef(null);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside search container to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch search suggestions from real backend API
  const { data: suggestionsData, isLoading: isSuggestionsLoading } = useQuery({
    queryKey: ['medicine-suggestions', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return [];
      const res = await api.get(`/medicines/suggestions?q=${encodeURIComponent(debouncedQuery)}`);
      return res.data || [];
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 60000,
  });

  const suggestions = suggestionsData || [];

  // Fetch notifications unread count
  const { data: notifData } = useQuery({
    queryKey: ['customer-notifications-count'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
    refetchInterval: 15000,
  });

  const unreadNotifs = notifData?.unreadCount || 0;

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchFocused(false);
      navigate(`/customer/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navigation = [
    { name: 'Overview', href: '/customer', icon: LayoutDashboard },
    { name: 'Browse Medicines', href: '/customer/medicines', icon: Pill },
    { name: 'Search Medicines', href: '/customer/search', icon: Search },
    { name: 'Upload Prescription', href: '/customer/prescriptions/upload', icon: UploadCloud },
    { name: 'My Prescriptions', href: '/customer/prescriptions', icon: FileText },
    { name: 'My Cart', href: '/customer/cart', icon: ShoppingCart, badge: cartCount > 0 ? cartCount : null },
    { name: 'My Orders', href: '/customer/orders', icon: Package },
    { name: 'Order Tracking', href: '/customer/orders/tracking', icon: Compass },
    { name: 'My Invoices', href: '/customer/invoices', icon: Receipt },
    { name: 'Payment History', href: '/customer/payments', icon: CreditCard },
    { name: 'My Profile', href: '/customer/profile', icon: User },
    { name: 'Notifications', href: '/customer/notifications', icon: Bell, badge: unreadNotifs > 0 ? unreadNotifs : null },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Professional Healthcare Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/customer" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center font-bold text-white text-lg shadow-sm">
                M+
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-slate-900 leading-none">
                  MediStock
                </span>
                <span className="text-[10px] tracking-wider uppercase text-teal-600 font-semibold mt-0.5">
                  Patient Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Live Debounced Medicine Search Bar */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-xl hidden md:block">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search medicines by name, brand, strength (e.g. Paracetamol)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                onFocus={() => setIsSearchFocused(true)}
                className="w-full pl-10 pr-20 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-teal-500 rounded-full focus:ring-2 focus:ring-teal-100 transition-all outline-none text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-12 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 top-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold rounded-full shadow-xs transition-colors"
              >
                Search
              </button>
            </form>

            {/* Instant Suggestions Dropdown */}
            {isSearchFocused && debouncedQuery.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Medicine Suggestions</span>
                  <span>Press Enter for all results</span>
                </div>

                {isSuggestionsLoading ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    Searching MySQL database...
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {suggestions.map((med) => (
                      <Link
                        key={med.id}
                        to={`/customer/medicines?id=${med.id}`}
                        onClick={() => setIsSearchFocused(false)}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-teal-50/60 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                            Rx
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900 group-hover:text-teal-700">
                              {med.medicine_name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {med.manufacturer} • {med.category} {med.strength && `• ${med.strength}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900">
                            ${med.selling_price?.toFixed(2)}
                          </span>
                          <span
                            className={cn(
                              'block text-[9px] font-semibold uppercase',
                              med.stock_status === 'in_stock'
                                ? 'text-emerald-600'
                                : med.stock_status === 'low_stock'
                                ? 'text-amber-600'
                                : 'text-red-500'
                            )}
                          >
                            {med.stock_status.replace('_', ' ')}
                          </span>
                        </div>
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-center text-xs font-semibold text-teal-700 flex items-center justify-center gap-1 transition-colors"
                    >
                      View all results for "{debouncedQuery}" <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-slate-700">No matching medicines found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Check your spelling or search by generic formulation
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Action Icons: Cart, Notifications, User */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cart Icon */}
            <Link
              to="/customer/cart"
              className="relative p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-full transition-colors"
              title="View Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-teal-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-50">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Notifications Icon */}
            <Link
              to="/customer/notifications"
              className="relative p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-full transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
              )}
            </Link>

            {/* Profile Menu Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 text-teal-400 font-bold text-xs flex items-center justify-center border border-slate-800">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[110px]">
                    {user?.name || 'Customer'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 leading-none">
                    Patient Account
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-800 truncate">{user?.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/customer/profile"
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" /> My Profile
                  </Link>
                  <Link
                    to="/customer/orders"
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Package className="w-3.5 h-3.5 text-slate-400" /> My Orders
                  </Link>
                  <Link
                    to="/customer/invoices"
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Receipt className="w-3.5 h-3.5 text-slate-400" /> My Invoices
                  </Link>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body with Customer Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Desktop Sidebar (Customer ecommerce navigation) */}
        <aside className="w-60 flex-shrink-0 hidden lg:block">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs sticky top-24 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Customer Portal
            </div>

            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-teal-50 text-teal-800 font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-4 h-4', isActive ? 'text-teal-600' : 'text-slate-400')} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                        isActive ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50/50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col p-4 z-10 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-sm">
                    M+
                  </div>
                  <span className="font-bold text-slate-900 text-sm">MediStock Portal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Search input */}
              <form onSubmit={(e) => { setMobileMenuOpen(false); handleSearchSubmit(e); }} className="my-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search medicines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </form>

              <div className="flex-1 overflow-y-auto space-y-1 py-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold',
                        isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn('w-4 h-4', isActive ? 'text-teal-600' : 'text-slate-400')} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Outlet */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
