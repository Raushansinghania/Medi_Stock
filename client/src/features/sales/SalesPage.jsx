import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Receipt,
  Search,
  Eye,
  CheckCircle,
  AlertCircle,
  X,
  Printer,
  Calendar,
  CreditCard,
  Ban,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  // Fetch sales
  const { data: sales = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sales', searchTerm, statusFilter, paymentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (paymentFilter) params.append('payment_method', paymentFilter);
      const res = await api.get(`/sales?${params.toString()}`);
      return res.data;
    },
  });

  // Fetch single sale details
  const { data: saleDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['sale-detail', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return null;
      const res = await api.get(`/sales/${selectedSaleId}`);
      return res.data;
    },
    enabled: !!selectedSaleId,
  });

  // Cancel sale mutation (Controlled administrative cancellation)
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.post(`/admin/sales/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-detail', selectedSaleId] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setCancelTarget(null);
      setCancelReason('');
      setStatusMsg({ type: 'success', text: 'Sale invoice cancelled and warehouse stock restored atomically in MySQL!' });
      setTimeout(() => setStatusMsg(null), 5000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || err.message });
      setTimeout(() => setStatusMsg(null), 5000);
    },
  });

  const handleCancelSubmit = (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <Receipt className="w-3.5 h-3.5" /> Fiscal Transaction Ledger
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales & Invoices Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit patient receipts, verify FEFO batch allocations, and execute controlled transaction cancellations.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 self-start"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice number or patient name..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
          >
            <option value="">All Invoice Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
          >
            <option value="">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" message="Loading sales transactions from MySQL..." />
          </div>
        ) : sales.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No sales transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {sale.invoice_number}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 leading-tight">{sale.customer_name || 'Walk-in Customer'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 uppercase font-mono">
                        <CreditCard className="w-3 h-3" /> {sale.payment_method || 'CASH'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatCurrency(sale.total_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          sale.status === 'cancelled'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {sale.status ? sale.status.toUpperCase() : 'COMPLETED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedSaleId(sale.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          title="View Details & Print Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {sale.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setCancelTarget(sale);
                              setCancelReason('');
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
                            title="Cancel Sale & Restore Stock"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: View Sale Details & Printable Receipt */}
      {selectedSaleId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col print:m-0 print:p-0 print:border-none print:shadow-none">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0 print:hidden">
              <h2 className="text-lg font-bold text-slate-900">
                Tax Invoice #{saleDetail?.invoice_number}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintReceipt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Tax Receipt
                </button>
                <button onClick={() => setSelectedSaleId(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isDetailLoading ? (
              <div className="py-16 flex justify-center">
                <LoadingSpinner size="md" message="Loading transaction items..." />
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto flex-1 mt-4">
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <h3 className="text-base font-bold text-slate-900">MediStock Central Pharmacy</h3>
                  <p className="text-xs text-slate-500">123 Healthcare Boulevard, Medical District</p>
                  <p className="text-xs text-slate-500">GSTIN: 27AABCU9603R1ZM • Phone: +1 (555) 019-2834</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p><span className="text-slate-400 font-medium">Customer:</span> <strong className="text-slate-800">{saleDetail?.customer_name || 'Walk-in Customer'}</strong></p>
                    <p><span className="text-slate-400 font-medium">Payment Mode:</span> <strong className="uppercase text-slate-800">{saleDetail?.payment_method || 'CASH'}</strong></p>
                  </div>
                  <div className="text-right">
                    <p><span className="text-slate-400 font-medium">Date:</span> <strong className="text-slate-800">{saleDetail?.sale_date}</strong></p>
                    <p>
                      <span className="text-slate-400 font-medium">Status:</span>{' '}
                      <strong className={saleDetail?.status === 'cancelled' ? 'text-red-600' : 'text-emerald-700'}>
                        {saleDetail?.status?.toUpperCase() || 'COMPLETED'}
                      </strong>
                    </p>
                  </div>
                </div>

                {saleDetail?.cancellation_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <strong>Cancellation Reason:</strong> {saleDetail.cancellation_reason}
                  </div>
                )}

                {/* Items */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Medicine Formulation</th>
                        <th className="py-2.5 px-3">Batch #</th>
                        <th className="py-2.5 px-3">Qty</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {saleDetail?.items?.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{item.medicine_name}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{item.batch_number || item.med_batch || 'N/A'}</td>
                          <td className="py-2.5 px-3">{item.quantity}</td>
                          <td className="py-2.5 px-3">{formatCurrency(item.unit_price)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border-t border-slate-200 pt-3 space-y-1 text-xs text-right">
                  <p className="text-slate-500">Subtotal: <span className="font-semibold text-slate-800">{formatCurrency(saleDetail?.subtotal)}</span></p>
                  <p className="text-slate-500">Tax / GST (5%): <span className="font-semibold text-slate-800">{formatCurrency(saleDetail?.tax)}</span></p>
                  <p className="text-slate-500">Discount: <span className="font-semibold text-slate-800">-{formatCurrency(saleDetail?.discount)}</span></p>
                  <p className="text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                    Total Invoiced: <span className="text-teal-700">{formatCurrency(saleDetail?.total_amount)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Controlled Cancellation */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <Ban className="w-5 h-5" /> Cancel Sale #{cancelTarget.invoice_number}
              </h2>
              <button onClick={() => setCancelTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              Cancelling this invoice will atomically restore the sold quantities back into the respective batch records and medicine warehouse inventory. A mandatory audit reason is required for financial compliance.
            </p>

            <form onSubmit={handleCancelSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mandatory Cancellation Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Patient returned prescription medication immediately / Billing entry error"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelMutation.isLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                >
                  {cancelMutation.isLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
