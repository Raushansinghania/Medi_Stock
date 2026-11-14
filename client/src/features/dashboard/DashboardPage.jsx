import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Boxes,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ShieldAlert,
  FileText,
  Truck,
  RotateCcw,
  Receipt,
  Pill,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState('30days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: telemetryData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard-telemetry', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('range', dateRange);
      if (dateRange === 'custom') {
        if (customFrom) params.append('from_date', customFrom);
        if (customTo) params.append('to_date', customTo);
      }
      const res = await api.get(`/admin/dashboard?${params.toString()}`);
      return res.data;
    },
    refetchInterval: 30000,
  });

  const biz = telemetryData?.business || {};
  const inv = telemetryData?.inventory || {};
  const ops = telemetryData?.operations || {};
  const charts = telemetryData?.charts || {};
  const alerts = telemetryData?.alerts || {};

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Page Header with Real-time Date Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            Central Command Center • MySQL 8.0 Live
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administrator Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time pharmacy financial intelligence, inventory valuation, and dispensing operations.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'custom', label: 'Custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateRange === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Real-time KPIs"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {dateRange === 'custom' && (
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">From:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2.5 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 text-slate-800 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">To:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 text-slate-800 text-xs"
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading enterprise telemetry from MySQL 8.0..." />
        </div>
      ) : (
        <>
          {/* SECTION 1: BUSINESS OVERVIEW */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                1. Business & Financial Performance ({dateRange.replace('_', ' ')})
              </h2>
              <Link to="/finance" className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1">
                View Full P&L <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Revenue */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Sales Revenue</span>
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(biz.total_revenue)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Today: <span className="font-semibold text-teal-600">{formatCurrency(biz.today_sales)}</span> ({biz.today_bills_count || 0} bills)
                </div>
              </div>

              {/* Total Purchases */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Purchases</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(biz.total_purchases)}</div>
                <div className="mt-1 text-xs text-slate-500">Wholesale inventory receipts</div>
              </div>

              {/* Gross Profit */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Gross Profit (COGS Adj.)</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(biz.gross_profit)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  COGS: <span className="font-medium text-slate-700">{formatCurrency(biz.cogs)}</span>
                </div>
              </div>

              {/* Net Profit */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Net Profit</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${biz.net_profit >= 0 ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-600'}`}>
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className={`mt-2 text-2xl font-bold ${biz.net_profit >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                  {formatCurrency(biz.net_profit)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Expenses: <span className="text-slate-700">{formatCurrency(biz.total_expenses)}</span> • Margin: <span className="font-semibold text-teal-600">{biz.profit_margin}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: INVENTORY & OPERATIONAL OVERVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* INVENTORY OVERVIEW */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-teal-600" /> Inventory Valuation & Batches
                </h3>
                <Link to="/inventory" className="text-xs text-teal-600 hover:text-teal-700 font-semibold">
                  Manage &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Total Medicines</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{inv.total_medicines || 0}</p>
                  <span className="text-[10px] text-slate-400">{inv.total_available_stock || 0} units</span>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-lg text-center border border-amber-100">
                  <span className="text-[11px] text-amber-700 font-medium">Low Stock</span>
                  <p className="text-lg font-bold text-amber-800 mt-0.5">{inv.low_stock_medicines || 0}</p>
                  <span className="text-[10px] text-amber-600">Threshold &le; 10</span>
                </div>
                <div className="p-3 bg-red-50/60 rounded-lg text-center border border-red-100">
                  <span className="text-[11px] text-red-700 font-medium">Expired Batches</span>
                  <p className="text-lg font-bold text-red-800 mt-0.5">{inv.expired_batches || 0}</p>
                  <span className="text-[10px] text-red-600">Blocked</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Inventory Asset Valuation:</span>
                <span className="font-bold text-slate-900 text-sm">{formatCurrency(inv.inventory_valuation)}</span>
              </div>
            </div>

            {/* OPERATIONAL OVERVIEW */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" /> Operational & Dispensary Pipeline
                </h3>
                <Link to="/prescriptions" className="text-xs text-teal-600 hover:text-teal-700 font-semibold">
                  Oversight &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-teal-50/60 rounded-lg text-center border border-teal-100">
                  <span className="text-[11px] text-teal-700 font-medium">Pending Rx</span>
                  <p className="text-lg font-bold text-teal-900 mt-0.5">{ops.pending_prescriptions || 0}</p>
                  <span className="text-[10px] text-teal-600">Awaiting Review</span>
                </div>
                <div className="p-3 bg-blue-50/60 rounded-lg text-center border border-blue-100">
                  <span className="text-[11px] text-blue-700 font-medium">Pending Orders</span>
                  <p className="text-lg font-bold text-blue-900 mt-0.5">{ops.pending_orders || 0}</p>
                  <span className="text-[10px] text-blue-600">In Fulfillment</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <span className="text-[11px] text-slate-500 font-medium">Recent Returns</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{ops.recent_returns || 0}</p>
                  <span className="text-[10px] text-slate-400">Inspections</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Pending Supplier Liabilities:</span>
                <span className="font-bold text-indigo-700 text-sm">{ops.pending_supplier_payments || 0} Orders Awaiting</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: INTERACTIVE VISUAL CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Sales Trend */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-1">Daily Sales Trend (Last 14 Days)</h3>
              <p className="text-xs text-slate-500 mb-4">Actual revenue and transaction counts from completed bills</p>
              <div className="h-64">
                {charts.dailySales && charts.dailySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.dailySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val}`} />
                      <Tooltip
                        formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Revenue']}
                        contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No sales recorded in the past 14 days
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Comparison: Sales vs Purchases vs Expenses */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-1">Monthly Financial Trend</h3>
              <p className="text-xs text-slate-500 mb-4">Comparison of Sales Revenue, Wholesale Purchases, and Operating Expenses</p>
              <div className="h-64">
                {charts.monthlyTrend && charts.monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `$${val}`} />
                      <Tooltip
                        formatter={(val) => [`$${Number(val).toFixed(2)}`]}
                        contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="sales_revenue" name="Sales Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="purchase_cost" name="Purchases" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No monthly telemetry records available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: REAL-TIME OPERATIONAL STREAMS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Prescriptions Queue */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" /> Pending Prescription Reviews
                </h3>
                <Link to="/prescriptions" className="text-xs text-teal-600 hover:text-teal-700 font-semibold">
                  Queue &rarr;
                </Link>
              </div>
              {alerts.pendingRxQueue && alerts.pendingRxQueue.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {alerts.pendingRxQueue.map((rx) => (
                    <div key={rx.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{rx.customer_name || 'Walk-in Patient'}</p>
                        <p className="text-[11px] text-slate-500">
                          Doctor: {rx.doctor_name || 'N/A'} • Contact: {rx.customer_phone || 'None'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">No prescriptions awaiting pharmacist review.</p>
              )}
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Critical Warning
                </h3>
                <Link to="/inventory" className="text-xs text-teal-600 hover:text-teal-700 font-semibold">
                  Reorder &rarr;
                </Link>
              </div>
              {alerts.lowStockAlerts && alerts.lowStockAlerts.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {alerts.lowStockAlerts.map((med) => (
                    <div key={med.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{med.medicine_name}</p>
                        <p className="text-[11px] text-slate-500">{med.category} • Cost: {formatCurrency(med.purchase_price)}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {med.quantity} in stock
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Threshold: &le; {med.reorder_level || 10}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">All inventory items are currently above threshold.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
