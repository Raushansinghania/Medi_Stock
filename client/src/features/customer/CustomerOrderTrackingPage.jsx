import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Compass,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Building,
  FileText,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerOrderTrackingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = searchParams.get('id');

  // Fetch customer orders for dropdown selector
  const { data: allOrders = [] } = useQuery({
    queryKey: ['customer-orders-for-track'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data || [];
    },
  });

  // Selected order ID defaults to query param or most recent order
  const activeId = orderId || (allOrders.length > 0 ? allOrders[0].id : null);

  // Fetch active order details
  const { data: orderDetails, isLoading } = useQuery({
    queryKey: ['customer-order-details', activeId],
    queryFn: async () => {
      if (!activeId) return null;
      const res = await api.get(`/orders/${activeId}`);
      return res.data;
    },
    enabled: !!activeId,
  });

  const stages = [
    { key: 'placed', label: 'Order Received', desc: 'Logged into MediStock pharmacy ERP' },
    { key: 'verified', label: 'Pharmacist Review', desc: 'Prescription & dosage verification' },
    { key: 'processing', label: 'Dispensary Packing', desc: 'FEFO batch allocation & safety labeling' },
    { key: 'ready', label: 'Ready for Collection', desc: 'Awaiting pickup or courier dispatch' },
    { key: 'delivered', label: 'Delivered / Completed', desc: 'Medication delivered to patient' },
  ];

  const getStageIndex = (status) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'awaiting_prescription':
        return 0;
      case 'confirmed':
        return 1;
      case 'processing':
        return 2;
      case 'ready_for_collection':
      case 'shipped':
        return 3;
      case 'delivered':
        return 4;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStageIdx = orderDetails ? getStageIndex(orderDetails.status) : 0;
  const isCancelled = orderDetails?.status === 'cancelled';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Live Order Tracking</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time fulfillment telemetry from order intake to pharmacy dispensation
          </p>
        </div>

        {/* Order Selector Dropdown */}
        {allOrders.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Track Order:</span>
            <select
              value={activeId || ''}
              onChange={(e) => setSearchParams({ id: e.target.value })}
              className="py-1.5 px-3 text-xs font-bold bg-white border border-slate-300 rounded-xl outline-none text-slate-800 shadow-2xs"
            >
              {allOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} ({o.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Loading real-time tracking telemetry..." />
        </div>
      ) : !orderDetails ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Order Selected</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            You don't have any orders to track yet. Place an order from the medicine catalogue.
          </p>
          <Link
            to="/customer/medicines"
            className="px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Browse Medicines
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Tracking Card with Visual Timeline */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 sm:p-8 space-y-8">
            {/* Top Bar with Number & Live Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <span className="text-xs font-semibold text-slate-400">Order Telemetry ID</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                  {orderDetails.order_number}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Placed on {new Date(orderDetails.created_at).toLocaleString()} • Fulfillment via{' '}
                  <span className="font-bold uppercase text-teal-700">{orderDetails.order_type}</span>
                </p>
              </div>

              <div className="sm:text-right">
                <span className="text-xs font-semibold text-slate-400 block">Current Status</span>
                <span
                  className={cn(
                    'inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border mt-1',
                    isCancelled
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : currentStageIdx === 4
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-teal-100 text-teal-800 border-teal-200'
                  )}
                >
                  {orderDetails.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Cancelled Banner */}
            {isCancelled ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-900">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">This Order Was Cancelled</h4>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    Reason: {orderDetails.cancellation_reason || 'Cancelled by request.'}
                  </p>
                </div>
              </div>
            ) : (
              /* Visual Progress Timeline */
              <div className="relative">
                {/* Horizontal progress bar for desktop */}
                <div className="hidden md:grid grid-cols-5 gap-4 relative">
                  {/* Connecting Line */}
                  <div className="absolute top-5 left-8 right-8 h-1 bg-slate-100 -z-0">
                    <div
                      className="h-full bg-teal-600 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, (currentStageIdx / (stages.length - 1)) * 100))}%`,
                      }}
                    />
                  </div>

                  {stages.map((stage, idx) => {
                    const isCompleted = idx <= currentStageIdx;
                    const isCurrent = idx === currentStageIdx;

                    return (
                      <div key={stage.key} className="relative z-10 flex flex-col items-center text-center">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all border-2',
                            isCompleted
                              ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-400',
                            isCurrent && 'ring-4 ring-teal-100 scale-110'
                          )}
                        >
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                        </div>
                        <h4
                          className={cn(
                            'text-xs font-bold mt-3',
                            isCompleted ? 'text-slate-900' : 'text-slate-400'
                          )}
                        >
                          {stage.label}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug max-w-[130px]">
                          {stage.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Vertical Timeline for Mobile */}
                <div className="md:hidden space-y-6 pl-4 border-l-2 border-slate-200 ml-4">
                  {stages.map((stage, idx) => {
                    const isCompleted = idx <= currentStageIdx;
                    const isCurrent = idx === currentStageIdx;

                    return (
                      <div key={stage.key} className="relative">
                        <div
                          className={cn(
                            'absolute -left-[25px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2',
                            isCompleted
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white border-slate-300 text-slate-400'
                          )}
                        >
                          {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <div className="pl-3">
                          <h4
                            className={cn(
                              'text-xs font-bold',
                              isCompleted ? 'text-slate-900' : 'text-slate-400'
                            )}
                          >
                            {stage.label}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{stage.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Details Grid: Ordered Items & Fulfillment Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Ordered Items List (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-600" /> Dispensed Medication Items
              </h3>

              <div className="divide-y divide-slate-100">
                {orderDetails.items?.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{item.medicine_name}</h4>
                      <p className="text-[11px] text-slate-400">
                        {item.dosage_form || 'Tablet'} {item.strength && `• ${item.strength}`} • Qty:{' '}
                        {item.quantity}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-900">
                      ${Number(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(orderDetails.subtotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(orderDetails.tax).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-100">
                  <span>Total Amount</span>
                  <span className="text-teal-700">
                    ${Number(orderDetails.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Destination & Payment details (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Destination Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  {orderDetails.order_type === 'delivery' ? (
                    <Truck className="w-4 h-4 text-teal-600" />
                  ) : (
                    <Building className="w-4 h-4 text-teal-600" />
                  )}
                  {orderDetails.order_type === 'delivery' ? 'Delivery Destination' : 'Counter Collection'}
                </h4>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {orderDetails.delivery_address || 'Main Pharmacy Counter Pickup'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Patient Contact: {orderDetails.customer_name || 'Michael Clark'} (
                  {orderDetails.customer_phone || '+1-555-0211'})
                </p>
              </div>

              {/* Payment Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-2 text-xs">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Payment Details
                </h4>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className="font-bold text-slate-900 uppercase">
                    {orderDetails.payment_method}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-600 uppercase">
                    {orderDetails.payment_status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
