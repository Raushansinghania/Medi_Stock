import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  PieChart as PieIcon,
  Download,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  Receipt,
  ShoppingCart,
  Boxes,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function FinancialManagementPage() {
  const [dateRange, setDateRange] = useState('30days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { data: finData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-finance-summary', dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('range', dateRange);
      if (dateRange === 'custom') {
        if (customFrom) params.append('from_date', customFrom);
        if (customTo) params.append('to_date', customTo);
      }
      const res = await api.get(`/admin/finance/summary?${params.toString()}`);
      return res.data;
    },
  });

  const pnl = finData?.pnl || {};
  const payments = finData?.paymentBreakdown || [];
  const expenses = finData?.expenseCategories || [];
  const purchases = finData?.purchases || {};
  const inventory = finData?.inventory || {};

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleExportCSV = () => {
    if (!finData) return;
    const rows = [
      ['Metric', 'Amount ($)'],
      ['Total Sales Revenue', pnl.total_sales || 0],
      ['Cost of Goods Sold (COGS)', pnl.cogs || 0],
      ['Gross Profit', pnl.gross_profit || 0],
      ['Gross Profit Margin (%)', `${pnl.gross_margin || 0}%`],
      ['Total Operating Expenses', pnl.operating_expenses || 0],
      ['Net Profit', pnl.net_profit || 0],
      ['Net Profit Margin (%)', `${pnl.net_margin || 0}%`],
      ['Sales Tax Collected', pnl.sales_tax || 0],
      ['Discounts Given', pnl.discounts || 0],
      ['Inventory Cost Valuation', inventory.inventory_valuation_cost || 0],
      ['Inventory Retail Valuation', inventory.inventory_valuation_retail || 0],
      ['Expired Stock Losses', inventory.expired_stock_loss || 0],
      ['Outstanding Supplier Liabilities', purchases.outstanding_payables || 0],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medistock_financial_summary_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> P&L Financial Governance
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Management & Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit pharmacy profitability, cost of goods sold, operating overhead, and inventory valuation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['today', '7days', '30days', 'this_month', 'last_month', 'custom'].map((tab) => (
            <button
              key={tab}
              onClick={() => setDateRange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateRange === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.replace('_', ' ').toUpperCase()}
            </button>
          ))}

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Calculating ledger balances from MySQL..." />
        </div>
      ) : (
        <>
          {/* Main Profit & Loss Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Revenue</span>
                <p className="text-3xl font-extrabold text-white mt-1">{formatCurrency(pnl.total_sales)}</p>
                <p className="text-xs text-slate-400 mt-1">Tax Collected: {formatCurrency(pnl.sales_tax)}</p>
              </div>

              <div className="md:pl-6 pt-4 md:pt-0">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Cost of Goods Sold</span>
                <p className="text-3xl font-extrabold text-indigo-300 mt-1">{formatCurrency(pnl.cogs)}</p>
                <p className="text-xs text-slate-400 mt-1">Batch purchase acquisition cost</p>
              </div>

              <div className="md:pl-6 pt-4 md:pt-0">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Operating Overhead</span>
                <p className="text-3xl font-extrabold text-rose-300 mt-1">{formatCurrency(pnl.operating_expenses)}</p>
                <p className="text-xs text-slate-400 mt-1">Rent, payroll, utilities</p>
              </div>

              <div className="md:pl-6 pt-4 md:pt-0">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Net Net Profit</span>
                <p className={`text-3xl font-extrabold mt-1 ${pnl.net_profit >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                  {formatCurrency(pnl.net_profit)}
                </p>
                <p className="text-xs text-teal-300 mt-1">Net Margin: <strong className="text-white">{pnl.net_margin}%</strong></p>
              </div>
            </div>
          </div>

          {/* Section: Payment Methods & Liabilities Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Method Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-600" /> Payment Inflows
              </h3>
              <div className="space-y-3">
                {payments.map((pm) => (
                  <div key={pm.method} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{pm.method}</span>
                      <p className="text-[11px] text-slate-400">{pm.count} transactions</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(pm.amount)}</span>
                  </div>
                ))}
                {payments.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No payment records found</p>
                )}
              </div>
            </div>

            {/* Expenses By Category */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-600" /> Operating Overhead Breakdown
              </h3>
              <div className="space-y-2.5">
                {expenses.map((exp) => (
                  <div key={exp.category} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">{exp.category}</span>
                    <span className="font-bold text-slate-900">{formatCurrency(exp.amount)}</span>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No expenses logged for this period</p>
                )}
              </div>
            </div>

            {/* Inventory Valuation & Liabilities */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-4 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-600" /> Balance Sheet Assets & Liabilities
              </h3>
              <div className="space-y-3 divide-y divide-slate-100">
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Inventory Asset (At Cost):</span>
                  <span className="font-bold text-slate-900">{formatCurrency(inventory.inventory_valuation_cost)}</span>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Inventory Retail Potential:</span>
                  <span className="font-bold text-teal-700">{formatCurrency(inventory.inventory_valuation_retail)}</span>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Expired Inventory Loss:</span>
                  <span className="font-bold text-red-600">{formatCurrency(inventory.expired_stock_loss)}</span>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Supplier Outstanding Payables:</span>
                  <span className="font-bold text-amber-700">{formatCurrency(purchases.outstanding_payables)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
