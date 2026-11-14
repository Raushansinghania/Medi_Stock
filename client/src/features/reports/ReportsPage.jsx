import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Boxes,
  Clock,
  Truck,
  Users,
  RotateCcw,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const REPORT_TABS = [
  { id: 'daily-sales', label: '1. Daily Sales', icon: TrendingUp },
  { id: 'monthly-sales', label: '2. Monthly Sales', icon: BarChart3 },
  { id: 'purchases', label: '3. Purchases', icon: ShoppingCart },
  { id: 'profit-and-loss', label: '4. Profit & Loss', icon: DollarSign },
  { id: 'inventory', label: '5. Inventory Valuation', icon: Boxes },
  { id: 'expiry', label: '6. Batch Expiry', icon: Clock },
  { id: 'low-stock', label: '7. Low Stock Warnings', icon: Boxes },
  { id: 'supplier-performance', label: '8. Supplier Performance', icon: Truck },
  { id: 'customer-purchases', label: '9. Customer Spend', icon: Users },
  { id: 'pharmacist-activity', label: '10. Pharmacist Dispensing', icon: UserCheck },
  { id: 'expenses', label: '11. Operating Expenses', icon: CreditCard },
  { id: 'returns', label: '12. Returns & Discards', icon: RotateCcw },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('daily-sales');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: reportResponse, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-report', activeReport, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      const res = await api.get(`/admin/reports/${activeReport}?${params.toString()}`);
      return res.data;
    },
  });

  const records = reportResponse?.records || [];

  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = Object.keys(records[0]);
    const csvRows = [
      headers.join(','),
      ...records.map((row) =>
        headers
          .map((field) => {
            const val = row[field];
            return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
          })
          .join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `medistock_${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`);
    a.click();
  };

  const formatVal = (val, key) => {
    if (val === null || val === undefined) return 'N/A';
    if (
      key.includes('price') ||
      key.includes('amount') ||
      key.includes('revenue') ||
      key.includes('subtotal') ||
      key.includes('tax') ||
      key.includes('discount') ||
      key.includes('valuation') ||
      key.includes('cogs') ||
      key.includes('spent') ||
      key === 'expenses'
    ) {
      return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return String(val);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <BarChart3 className="w-3.5 h-3.5" /> 12 Relational SQL Reports
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Business Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Query actual MySQL 8.0 transactions across sales, clinical dispensing, procurement, and profitability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV ({records.length})
          </button>
        </div>
      </div>

      {/* 12 Report Selection Pills */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-1.5">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 text-xs">
        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" /> Date Filter:
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2.5 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 text-slate-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2.5 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 text-slate-800"
          />
        </div>
        {(fromDate || toDate) && (
          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
            className="text-teal-600 hover:text-teal-800 font-semibold underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Report Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" message="Compiling report query..." />
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No records found for this report range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                <tr>
                  {Object.keys(records[0]).map((col) => (
                    <th key={col} className="py-3 px-4">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    {Object.keys(row).map((col) => (
                      <td key={col} className="py-2.5 px-4 font-medium text-slate-800">
                        {formatVal(row[col], col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
