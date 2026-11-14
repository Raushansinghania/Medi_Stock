import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  Building,
  User,
  Phone,
  Calendar,
  X,
  FileCheck2,
  Receipt,
  AlertCircle,
  Eye,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Ban,
  ArrowRight,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function OrdersManagementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Fetch all orders
  const { data: ordersResponse, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['staff-orders', statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('limit', '100');
      const res = await api.get(`/orders?${params.toString()}`);
      return res.data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch detailed single order when opened in modal
  const { data: orderDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['staff-order-detail', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return null;
      const res = await api.get(`/orders/${selectedOrder.id}`);
      return res.data;
    },
    enabled: !!selectedOrder,
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const res = await api.patch(`/orders/${id}/status`, { status, notes });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      queryClient.invalidateQueries({ queryKey: ['staff-order-detail', selectedOrder?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });

      setStatusMsg({
        type: 'success',
        text: `Order #${data.order_number} status updated to ${data.status.toUpperCase()}!${
          ['delivered', 'ready_for_collection'].includes(data.status)
            ? ' Stock deducted via FEFO and Tax Invoice INV-' + data.order_number + ' generated.'
            : ''
        }`,
      });
      setTimeout(() => setStatusMsg(null), 5000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to update order status');
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.patch(`/orders/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      queryClient.invalidateQueries({ queryKey: ['staff-order-detail', selectedOrder?.id] });
      setCancelModalOrder(null);
      setCancelReason('');
      setStatusMsg({ type: 'success', text: 'Order cancelled successfully.' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to cancel order');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const orders = Array.isArray(ordersResponse) ? ordersResponse : ordersResponse?.records || [];

  const getBadgeStyle = (status) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ready_for_collection':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'processing':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'confirmed':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'awaiting_prescription':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <Package className="w-3.5 h-3.5" /> Clinical Fulfillment & Dispensary Queue
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Orders Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Process online patient orders, verify attached prescriptions, execute FEFO dispensing, and finalize sales.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition"
        >
          <RefreshCw className={cn('w-4 h-4 text-teal-600', isFetching && 'animate-spin')} /> Refresh Queue
        </button>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by order #, customer name..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {[
            { id: '', label: 'All Orders' },
            { id: 'pending', label: 'Pending' },
            { id: 'awaiting_prescription', label: 'Awaiting Rx' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'processing', label: 'Processing' },
            { id: 'ready_for_collection', label: 'Ready for Pickup' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition',
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <LoadingSpinner size="lg" text="Retrieving orders from MySQL..." />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-40 text-teal-600" />
            <h3 className="font-bold text-slate-800 text-sm">No orders found</h3>
            <p className="text-xs text-slate-500 mt-1">There are no orders matching your current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-teal-700">{ord.order_number}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {ord.created_at ? new Date(ord.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{ord.customer_name || 'Patient #' + ord.customer_id}</p>
                      <p className="text-[11px] text-slate-400">{ord.customer_phone || ord.customer_email || '—'}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        {ord.order_type === 'delivery' ? (
                          <>
                            <Truck className="w-3.5 h-3.5 text-teal-600" /> Delivery
                          </>
                        ) : (
                          <>
                            <Building className="w-3.5 h-3.5 text-blue-600" /> Pickup
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700">{ord.total_items || 1}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ${Number(ord.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold border', getBadgeStyle(ord.status))}>
                        {ord.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                          ord.payment_status === 'successful'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {ord.payment_status ? ord.payment_status.toUpperCase() : 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold border border-teal-200 inline-flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details & Fulfillment Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Order #{selectedOrder.order_number}
                </h3>
                <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold border ml-2', getBadgeStyle(selectedOrder.status))}>
                  {selectedOrder.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Patient Info Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Customer / Patient</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">
                    {orderDetail?.customer_name || selectedOrder.customer_name || 'Patient #' + selectedOrder.customer_id}
                  </p>
                  <p className="text-slate-500">{orderDetail?.customer_phone || selectedOrder.customer_phone || 'No phone'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Fulfillment Type</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedOrder.order_type === 'delivery' ? 'Home Delivery' : 'Counter Pickup'}
                  </p>
                  <p className="text-slate-500 truncate" title={selectedOrder.delivery_address}>
                    {selectedOrder.delivery_address || 'Main Pharmacy Counter'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Payment & Billing</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    Method: {selectedOrder.payment_method?.toUpperCase() || 'CASH'}
                  </p>
                  <p className="text-slate-500">Status: {selectedOrder.payment_status || 'pending'}</p>
                </div>
              </div>

              {/* Prescription Attachment info if any */}
              {orderDetail?.prescription_id && (
                <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-teal-700" />
                    <div>
                      <span className="font-bold text-teal-900">Attached Prescription #{orderDetail.prescription_id}</span>
                      <p className="text-[11px] text-teal-700">
                        Doctor: {orderDetail.doctor_name || 'Attending Physician'} • Rx Status: {orderDetail.prescription_status?.toUpperCase() || 'VERIFIED'}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/v1/prescriptions/${orderDetail.prescription_id}/file?token=${localStorage.getItem('medistock_token') || ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] inline-flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> View Rx File
                  </a>
                </div>
              )}

              {/* Items List */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Prescribed & Ordered Items</h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Medicine Formulation</th>
                        <th className="py-2.5 px-3 text-center">Category</th>
                        <th className="py-2.5 px-3 text-center">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(orderDetail?.items || []).map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {it.medicine_name}
                            {it.strength && <span className="text-slate-400 text-[10px] ml-1">({it.strength})</span>}
                            {it.is_prescription_required ? (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                Rx
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500">{it.category || 'General'}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-teal-700">{it.quantity}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">${Number(it.unit_price).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">${Number(it.subtotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                      <tr>
                        <td colSpan="4" className="py-2 px-3 text-right text-slate-500">Subtotal:</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">${Number(selectedOrder.subtotal).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan="4" className="py-2 px-3 text-right text-slate-500">Tax (5%):</td>
                        <td className="py-2 px-3 text-right text-slate-900">${Number(selectedOrder.tax || 0).toFixed(2)}</td>
                      </tr>
                      <tr className="border-t border-slate-200 bg-teal-50/50">
                        <td colSpan="4" className="py-2.5 px-3 text-right font-bold text-teal-900">Total Bill Amount:</td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-900 text-sm">
                          ${Number(selectedOrder.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">Patient Order Instructions: </span>
                  <span className="text-slate-600">{selectedOrder.notes}</span>
                </div>
              )}

              {/* Action Decision Controls */}
              <div className="pt-4 border-t border-slate-200">
                <span className="font-bold text-slate-800 block mb-2">Fulfillment & Dispensing Actions:</span>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === 'pending' && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, status: 'confirmed' })}
                      disabled={updateStatusMutation.isLoading}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Confirm Order
                    </button>
                  )}

                  {['pending', 'confirmed'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, status: 'processing' })}
                      disabled={updateStatusMutation.isLoading}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition shadow-xs flex items-center gap-1.5"
                    >
                      <Clock className="w-4 h-4" /> Move to Processing & Packing
                    </button>
                  )}

                  {['confirmed', 'processing'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, status: 'ready_for_collection' })}
                      disabled={updateStatusMutation.isLoading}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-xs flex items-center gap-1.5"
                    >
                      <Building className="w-4 h-4" /> Mark Ready for Counter Pickup
                    </button>
                  )}

                  {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, status: 'delivered' })}
                      disabled={updateStatusMutation.isLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" /> Dispense, Bill & Deliver (FEFO)
                    </button>
                  )}

                  {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                    <button
                      onClick={() => setCancelModalOrder(selectedOrder)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold transition flex items-center gap-1.5 ml-auto"
                    >
                      <Ban className="w-4 h-4" /> Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900">Cancel Order #{cancelModalOrder.order_number}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Please enter the clinical or operational cancellation reason. The patient will be notified.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation Reason *</label>
              <textarea
                rows="3"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Prescribed medicine discontinued, prescription rejected, or patient request."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
              ></textarea>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Close
              </button>
              <button
                onClick={() =>
                  cancelOrderMutation.mutate({
                    id: cancelModalOrder.id,
                    reason: cancelReason || 'Cancelled by pharmacy staff',
                  })
                }
                disabled={cancelOrderMutation.isLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
