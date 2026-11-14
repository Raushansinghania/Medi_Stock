import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  CreditCard,
  DollarSign,
  QrCode,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Receipt,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerPaymentsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch payments (backend automatically isolates to logged in customer)
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['customer-payments'],
    queryFn: async () => {
      const res = await api.get('/payments');
      return res.data || [];
    },
  });

  const payments = (paymentsData || []).filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(p.id).includes(term) ||
      (p.invoice_number && p.invoice_number.toLowerCase().includes(term)) ||
      (p.payment_method && p.payment_method.toLowerCase().includes(term))
    );
  });

  const getMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'card':
        return <CreditCard className="w-4 h-4 text-teal-600" />;
      case 'upi':
        return <QrCode className="w-4 h-4 text-purple-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment History</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Verified financial transaction records for counter and online pharmacy checkouts
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by invoice number or payment method..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800"
          />
        </div>
        <span className="text-xs font-semibold text-slate-400">
          {payments.length} Verified Transactions
        </span>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Retrieving payment ledger from MySQL..." />
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No payment records found</h3>
          <p className="text-xs text-slate-500 mt-1">
            You don't have any recorded payment transactions in your patient ledger.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Linked Invoice</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #TXN-{String(p.id).padStart(5, '0')}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-teal-700">
                      {p.invoice_number || 'Counter Sale'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 font-semibold uppercase text-[11px] text-slate-700">
                        {getMethodIcon(p.payment_method)}
                        <span>{p.payment_method}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(p.payment_date).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        <CheckCircle className="w-3 h-3" />
                        {p.payment_status || 'Successful'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      ${Number(p.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
