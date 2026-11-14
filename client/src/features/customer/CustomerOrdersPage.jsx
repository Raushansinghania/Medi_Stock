import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import {
  Package,
  Search,
  Clock,
  Compass,
  AlertCircle,
  CheckCircle,
  X,
  ChevronRight,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerOrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionMsg, setActionMsg] = useState(null);

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['customer-orders', statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      const res = await api.get(`/orders?${params.toString()}`);
      return res.data || [];
    },
  });

  const orders = ordersData || [];

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.patch(`/orders/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['customer-dashboard-metrics'] });
      setCancellingOrder(null);
      setCancelReason('');
      setActionMsg({ type: 'success', text: 'Order cancelled successfully.' });
      setTimeout(() => setActionMsg(null), 4000);
    },
    onError: (err) => {
      setActionMsg({ type: 'error', text: err.message || 'Failed to cancel order.' });
      setTimeout(() => setActionMsg(null), 4000);
    },
  });

  const getStatusBadge = (status) => {
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Pharmacy Orders</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track fulfillment progress, view itemized orders, or manage cancellations
          </p>
        </div>
        <Link
          to="/customer/medicines"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
        >
          <ShoppingBag className="w-4 h-4" /> Place New Order
        </Link>
      </div>

      {actionMsg && (
        <div
          className={cn(
            'p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between',
            actionMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          )}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by order number (e.g. ORD-...)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
          {['', 'pending', 'processing', 'ready_for_collection', 'delivered', 'cancelled'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cn(
                'px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap capitalize transition-colors',
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {st ? st.replace(/_/g, ' ') : 'All Orders'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Loading orders from database..." />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No orders found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You don't have any orders matching your current filter. Browse our catalogue to place a medication request.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {orders.map((ord) => {
            const canCancel = ['pending', 'awaiting_prescription'].includes(ord.status);

            return (
              <div key={ord.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-black text-slate-900">{ord.order_number}</span>
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                          getStatusBadge(ord.status)
                        )}
                      >
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">
                        {ord.order_type}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      Placed on {new Date(ord.created_at).toLocaleString()} • {ord.total_items} medication item(s)
                    </p>

                    {ord.delivery_address && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Destination: {ord.delivery_address}
                      </p>
                    )}

                    {ord.cancellation_reason && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">
                        Cancellation note: {ord.cancellation_reason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 block">
                      ${Number(ord.total_amount || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                      Payment: {ord.payment_status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/customer/orders/tracking?id=${ord.id}`}
                      className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Compass className="w-3.5 h-3.5" /> Track Live
                    </Link>

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setCancellingOrder(ord)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Cancel Order {cancellingOrder.order_number}?
            </h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to cancel this order? Once cancelled, any scheduled fulfillment will be halted.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation:
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="E.g., Ordered by mistake, found alternative..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() =>
                  cancelMutation.mutate({
                    id: cancellingOrder.id,
                    reason: cancelReason || 'Cancelled by customer',
                  })
                }
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
