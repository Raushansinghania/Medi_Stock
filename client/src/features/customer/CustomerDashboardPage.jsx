import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '@/lib/axios';
import {
  Package,
  FileText,
  Receipt,
  Bell,
  ArrowRight,
  UploadCloud,
  Pill,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerDashboardPage() {
  const { user } = useSelector((state) => state.auth);

  // Fetch dedicated customer dashboard telemetry
  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['customer-dashboard-metrics'],
    queryFn: async () => {
      const res = await api.get('/customers/me/dashboard');
      return res.data;
    },
    refetchInterval: 20000,
  });

  const stats = dashboardData?.stats || {
    totalOrders: 0,
    activeOrders: 0,
    totalSpent: 0,
    totalPrescriptions: 0,
    pendingPrescriptions: 0,
    approvedPrescriptions: 0,
    totalInvoices: 0,
    unreadNotifications: 0,
  };

  const recentOrders = dashboardData?.recentOrders || [];
  const recentPrescriptions = dashboardData?.recentPrescriptions || [];
  const profile = dashboardData?.profile || {};

  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'processing':
      case 'confirmed':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'ready_for_collection':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'awaiting_prescription':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getRxStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <LoadingSpinner size="lg" text="Loading your personal pharmacy dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-200 text-xs font-semibold backdrop-blur-md mb-3 border border-teal-400/30">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-300" /> Verified Patient Account
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {user?.name || 'Valued Patient'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-teal-100/90 leading-relaxed">
            Order authentic medications, upload doctor prescriptions for pharmacist review, and track delivery progress in real time.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/customer/medicines"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              <Pill className="w-4 h-4" /> Browse Medicines
            </Link>
            <Link
              to="/customer/prescriptions/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md border border-white/20 transition-all"
            >
              <UploadCloud className="w-4 h-4 text-teal-300" /> Upload Prescription
            </Link>
          </div>
        </div>

        {/* Decorative Pill Art */}
        <div className="absolute -right-8 -bottom-10 opacity-15 pointer-events-none hidden sm:block">
          <Pill className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Orders */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-teal-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Orders</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.activeOrders}</p>
          <span className="text-[11px] text-teal-600 font-medium mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> In fulfillment pipeline
          </span>
        </div>

        {/* Total Prescriptions */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-teal-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Prescriptions</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.totalPrescriptions}</p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {stats.approvedPrescriptions} Approved & Valid
          </span>
        </div>

        {/* Completed Invoices */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-teal-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">My Invoices</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.totalInvoices}</p>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            ${stats.totalSpent?.toFixed(2)} Total Spend
          </span>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-teal-200 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Unread Alerts</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.unreadNotifications}</p>
          <Link
            to="/customer/notifications"
            className="text-[11px] text-teal-600 font-medium mt-1 hover:underline flex items-center gap-1"
          >
            Review notifications <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Content Grid: Recent Orders (Left 7) & Recent Prescriptions (Right 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Orders Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Medicine Orders</h3>
              <p className="text-[11px] text-slate-400">Track and view your recent online pharmacy requests</p>
            </div>
            <Link
              to="/customer/orders"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No recent orders yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                Explore our catalog to find essential medications
              </p>
              <Link
                to="/customer/medicines"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 rounded-xl px-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                      <Package className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{ord.order_number}</span>
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          {ord.order_type}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(ord.created_at).toLocaleDateString()} • {ord.items_count} items
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        ${Number(ord.total_amount || 0).toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border mt-0.5',
                          getOrderStatusBadge(ord.status)
                        )}
                      >
                        {ord.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <Link
                      to={`/customer/orders/tracking?id=${ord.id}`}
                      className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Track Order"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Prescriptions (Right 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">My Prescriptions</h3>
              <p className="text-[11px] text-slate-400">Uploaded for pharmacist verification</p>
            </div>
            <Link
              to="/customer/prescriptions"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentPrescriptions.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No prescriptions uploaded</p>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                Have a doctor's prescription? Upload it here for fast verification.
              </p>
              <Link
                to="/customer/prescriptions/upload"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold"
              >
                Upload Now
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentPrescriptions.map((rx) => (
                <div key={rx.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[180px]">
                      {rx.doctor_name || 'Attending Physician'}
                    </span>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border',
                        getRxStatusBadge(rx.status)
                      )}
                    >
                      {rx.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Prescribed: {rx.prescription_date ? new Date(rx.prescription_date).toLocaleDateString() : 'Recent'}
                  </p>

                  {rx.status === 'rejected' && rx.rejection_reason && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-800 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                      <span>{rx.rejection_reason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Patient Health Safety & Guarantee Notice */}
      <div className="p-4 sm:p-5 bg-teal-50/70 border border-teal-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-teal-950">100% Genuine Pharmacy Dispensation Guarantee</h4>
            <p className="text-[11px] text-teal-800 mt-0.5">
              All medicines are stored in temperature-controlled facilities and dispensed under the supervision of certified clinical pharmacists.
            </p>
          </div>
        </div>

        <Link
          to="/customer/medicines"
          className="text-xs font-bold text-teal-700 hover:text-teal-900 whitespace-nowrap flex items-center gap-1"
        >
          Explore Catalog <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
