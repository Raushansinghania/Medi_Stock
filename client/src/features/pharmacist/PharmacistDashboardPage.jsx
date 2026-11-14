import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import {
  DollarSign,
  Receipt,
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ClockAlert,
  Pill,
  ArrowRight,
  TrendingUp,
  Boxes,
  Layers,
  RotateCcw,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function PharmacistDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pharmacist-dashboard'],
    queryFn: async () => {
      const res = await api.get('/pharmacist/dashboard');
      return res.data;
    },
    refetchInterval: 15000, // live 15s refresh
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
        <p className="mt-4 text-sm text-slate-500 font-medium">Loading clinical pharmacy telemetry...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-sm max-w-lg mx-auto my-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Failed to load pharmacy dashboard</h3>
        <p className="text-xs text-slate-500 mt-1">Unable to connect to live MySQL database.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { stats, recentSales = [], pendingRxQueue = [], lowStockList = [], expiryAlerts = [], recentDispensing = [], dailySales = [] } =
    data || {};

  const kpiCards = [
    {
      title: "Today's Total Sales",
      value: `₹${Number(stats?.todaySales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badge: 'Live MySQL',
    },
    {
      title: "Today's Completed Bills",
      value: stats?.todayBills || 0,
      icon: Receipt,
      color: 'bg-teal-50 text-teal-700 border-teal-200',
      badge: 'Invoices',
    },
    {
      title: 'Pending Prescriptions',
      value: stats?.pendingPrescriptions || 0,
      icon: FileCheck2,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      badge: 'Needs Review',
      urgent: (stats?.pendingPrescriptions || 0) > 0,
      link: '/pharmacist/prescriptions',
    },
    {
      title: 'Approved Prescriptions',
      value: stats?.approvedPrescriptions || 0,
      icon: CheckCircle2,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      badge: 'Verified',
    },
    {
      title: 'Rejected Prescriptions',
      value: stats?.rejectedPrescriptions || 0,
      icon: XCircle,
      color: 'bg-slate-50 text-slate-700 border-slate-200',
      badge: 'Non-compliant',
    },
    {
      title: 'Low Stock Medicines',
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      badge: '≤ 15 Units',
      urgent: (stats?.lowStockCount || 0) > 0,
      link: '/pharmacist/inventory',
    },
    {
      title: 'Near Expiry Batches',
      value: stats?.nearExpiryCount || 0,
      icon: ClockAlert,
      color: 'bg-red-50 text-red-700 border-red-200',
      badge: '≤ 90 Days',
      urgent: (stats?.nearExpiryCount || 0) > 0,
      link: '/pharmacist/expiry',
    },
    {
      title: "Today's Dispensed Units",
      value: `${stats?.todayDispensedUnits || 0} Units`,
      icon: Pill,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      badge: 'FEFO Dispensed',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pharmacist Operations Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
              Live Real-Time
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time prescription verification, FEFO batch allocation, inventory monitoring, and clinical dispensing.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/pharmacist/pos"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Receipt className="w-3.5 h-3.5" />
            Launch POS
          </Link>
          <Link
            to="/pharmacist/prescriptions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Verify Prescriptions
          </Link>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            title="Refresh live data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 8 Primary Clinical & Dispensing Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`p-4 rounded-2xl border transition-all duration-200 bg-white shadow-sm hover:shadow-md ${
                card.urgent ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.title}</span>
                <div className={`p-2 rounded-xl border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-slate-900">{card.value}</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {card.badge}
                </span>
              </div>
              {card.link && (
                <Link
                  to={card.link}
                  className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                >
                  Action needed <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Daily Sales Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600" /> Daily Clinical Sales & Dispensing Revenue
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live transaction metrics from completed POS sales and fulfilled online orders (Last 14 days)
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 self-start sm:self-auto">
            Actual MySQL Sales Ledger
          </span>
        </div>
        <div className="h-56">
          {dailySales && dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pharmaSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Revenue']}
                  labelFormatter={(lbl) => `Date: ${lbl}`}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#pharmaSales)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No sales records logged in the last 14 days. POS checkouts will populate here.
            </div>
          )}
        </div>
      </div>

      {/* 2-Column Clinical Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Prescriptions & Dispensing */}
        <div className="lg:col-span-7 space-y-6">
          {/* Pending Prescription Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">Pending Prescription Verification Queue</h3>
                {pendingRxQueue.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {pendingRxQueue.length} Waiting
                  </span>
                )}
              </div>
              <Link
                to="/pharmacist/prescriptions"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                View Queue <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {pendingRxQueue.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-medium">All prescriptions have been verified and processed.</p>
                </div>
              ) : (
                pendingRxQueue.map((rx) => (
                  <div key={rx.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-mono text-xs font-bold flex-shrink-0">
                        #{rx.id}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          Patient: {rx.customer_name || 'Registered Customer'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Prescriber: {rx.doctor_name || 'Dr. Attending'} • Date:{' '}
                          {rx.prescription_date ? new Date(rx.prescription_date).toLocaleDateString() : 'Recent'}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/pharmacist/prescriptions"
                      className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold border border-teal-200 flex-shrink-0"
                    >
                      Review Rx
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent FEFO Dispensing Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">Recent FEFO Dispensing Log</h3>
              </div>
              <Link
                to="/pharmacist/sales"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                All Sales <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Medicine</th>
                    <th className="py-2.5 px-3">Batch Allocated</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentDispensing.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-slate-400">
                        No dispensing activity recorded today.
                      </td>
                    </tr>
                  ) : (
                    recentDispensing.slice(0, 5).map((disp) => (
                      <tr key={disp.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {disp.medicine_name}
                          {disp.strength && <span className="text-[10px] text-slate-400 ml-1">({disp.strength})</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {disp.batch_number || 'FEFO Auto'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-teal-700">{disp.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500">
                          {disp.invoice_number}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Alerts & Quick POS */}
        <div className="lg:col-span-5 space-y-6">
          {/* Expiry Alerts Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-red-50/40">
              <div className="flex items-center gap-2">
                <ClockAlert className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-800">Expiry Monitoring Alerts</h3>
              </div>
              <Link
                to="/pharmacist/expiry"
                className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                Inspect <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {expiryAlerts.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No near-expiry batches detected in next 90 days.
                </div>
              ) : (
                expiryAlerts.map((exp) => {
                  const isExpired = exp.days_left < 0;
                  return (
                    <div key={exp.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{exp.medicine_name}</p>
                        <p className="text-[11px] text-slate-500">
                          Batch: <span className="font-mono">{exp.batch_number}</span> • Qty: {exp.quantity}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isExpired
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isExpired ? 'EXPIRED' : `${exp.days_left}d left`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-800">Critical Low Stock</h3>
              </div>
              <Link
                to="/pharmacist/inventory"
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                Stock List <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {lowStockList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  All active medicine stock is above critical threshold.
                </div>
              ) : (
                lowStockList.map((med) => (
                  <div key={med.id} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{med.medicine_name}</p>
                      <p className="text-[11px] text-slate-400">{med.category || 'General'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 border border-rose-200 text-[11px]">
                      {med.quantity} left
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Shortcuts Widget */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-400">Pharmacist Toolkit</h4>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Link
                to="/pharmacist/fefo"
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-2 transition"
              >
                <Layers className="w-4 h-4 text-teal-400" />
                <span>FEFO Simulator</span>
              </Link>
              <Link
                to="/pharmacist/returns"
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Inspect Returns</span>
              </Link>
              <Link
                to="/pharmacist/expiry"
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-2 transition"
              >
                <ClockAlert className="w-4 h-4 text-red-400" />
                <span>Expiry Audit</span>
              </Link>
              <Link
                to="/pharmacist/customers"
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-2 transition"
              >
                <Boxes className="w-4 h-4 text-cyan-400" />
                <span>Walk-in Patient</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
