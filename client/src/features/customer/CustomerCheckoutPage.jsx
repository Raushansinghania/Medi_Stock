import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clearCart } from '@/store/slices/cartSlice';
import api from '@/lib/axios';
import {
  ShieldCheck,
  ShieldAlert,
  Truck,
  Building,
  CreditCard,
  QrCode,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  FileText,
  UploadCloud,
  ArrowRight,
  Package,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerCheckoutPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { user } = useSelector((state) => state.auth);
  const cartItems = useSelector((state) => state.cart?.items || []);

  const subtotal = Math.round(cartItems.reduce((acc, item) => acc + item.subtotal, 0) * 100) / 100;
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const hasRxItem = cartItems.some((item) => item.is_prescription_required);

  // Form states
  const [orderType, setOrderType] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('12 Elm Street, Springfield');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Fetch approved prescriptions
  const { data: prescriptions = [] } = useQuery({
    queryKey: ['customer-approved-prescriptions'],
    queryFn: async () => {
      const res = await api.get('/prescriptions');
      return res.data || [];
    },
  });

  const approvedPrescriptions = prescriptions.filter((p) => p.status === 'approved');

  // Order Mutation
  const orderMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/orders', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customer-dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      dispatch(clearCart());
      setConfirmedOrder(data);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to place order. Please review your details.');
    },
  });

  const handleSubmitOrder = (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cartItems.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    if (hasRxItem && !selectedPrescriptionId) {
      setErrorMsg('Prescription required: Please attach an approved prescription from your file to proceed.');
      return;
    }

    orderMutation.mutate({
      items: cartItems.map((i) => ({
        medicine_id: i.medicine_id,
        quantity: i.quantity,
      })),
      order_type: orderType,
      delivery_address: orderType === 'delivery' ? deliveryAddress : 'Main Pharmacy Counter Pickup',
      payment_method: paymentMethod,
      prescription_id: selectedPrescriptionId ? Number(selectedPrescriptionId) : null,
      notes,
    });
  };

  // If order is placed, show success confirmation screen
  if (confirmedOrder) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-in zoom-in-50">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 uppercase tracking-wider">
              Order Confirmed
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-2">
              Thank You for Your Order!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Your pharmacy order has been logged into our MySQL dispatch system.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Reference:</span>
              <span className="font-bold text-slate-900">{confirmedOrder.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fulfillment Method:</span>
              <span className="font-semibold text-slate-800 uppercase">{confirmedOrder.order_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Amount:</span>
              <span className="font-black text-teal-700 text-sm">
                ${Number(confirmedOrder.total_amount || total).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Status:</span>
              <span className="font-bold text-amber-600 capitalize">
                {confirmedOrder.payment_status || 'Pending Verification'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to={`/customer/orders/tracking?id=${confirmedOrder.id}`}
              className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Package className="w-4 h-4" /> Track Live Order Progress
            </Link>
            <Link
              to="/customer/orders"
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              View All Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Secure Pharmacy Checkout</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Complete delivery details and select fulfillment options for your medications
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-xs text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmitOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Fulfillment Type */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900">Fulfillment & Delivery Method</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setOrderType('pickup')}
                  className={cn(
                    'p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3',
                    orderType === 'pickup'
                      ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Building className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Counter Pickup (Free)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pick up directly at the main pharmacy dispensary counter within 30 minutes.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setOrderType('delivery')}
                  className={cn(
                    'p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3',
                    orderType === 'delivery'
                      ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Truck className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Home Delivery (Standard)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Temperature-monitored courier delivery straight to your doorstep.
                    </p>
                  </div>
                </div>
              </div>

              {orderType === 'delivery' && (
                <div className="pt-2 animate-in fade-in duration-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Address
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter complete street address, apartment, city, and zip..."
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none text-slate-800"
                  />
                </div>
              )}
            </div>

            {/* Step 2: Prescription Attachment (If needed) */}
            {hasRxItem && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Attach Approved Doctor Prescription</h3>
                </div>

                {approvedPrescriptions.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                    <p className="font-semibold">
                      You do not have any approved prescriptions on file yet.
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Please upload your prescription first so our pharmacist can verify it before you place an order for regulated items.
                    </p>
                    <Link
                      to="/customer/prescriptions/upload"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg mt-1"
                    >
                      <UploadCloud className="w-3.5 h-3.5" /> Upload Prescription Now
                    </Link>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Approved Prescription:
                    </label>
                    <select
                      value={selectedPrescriptionId}
                      onChange={(e) => setSelectedPrescriptionId(e.target.value)}
                      required
                      className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none text-slate-800"
                    >
                      <option value="">-- Choose verified prescription from your records --</option>
                      {approvedPrescriptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.doctor_name || 'Doctor Prescription'} ({new Date(p.prescription_date).toLocaleDateString()}) - Approved
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Payment Method */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                  {hasRxItem ? '3' : '2'}
                </div>
                <h3 className="text-sm font-bold text-slate-900">Payment Option</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cash */}
                <div
                  onClick={() => setPaymentMethod('cash')}
                  className={cn(
                    'p-3.5 rounded-xl border cursor-pointer text-center transition-all',
                    paymentMethod === 'cash'
                      ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <DollarSign className="w-6 h-6 text-teal-600 mx-auto mb-1" />
                  <span className="text-xs font-bold text-slate-800 block">Cash On Pickup/Delivery</span>
                  <span className="text-[10px] text-slate-400">Pay at the counter</span>
                </div>

                {/* Card */}
                <div
                  onClick={() => setPaymentMethod('card')}
                  className={cn(
                    'p-3.5 rounded-xl border cursor-pointer text-center transition-all',
                    paymentMethod === 'card'
                      ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <CreditCard className="w-6 h-6 text-teal-600 mx-auto mb-1" />
                  <span className="text-xs font-bold text-slate-800 block">Card Payment</span>
                  <span className="text-[10px] text-slate-400">Debit / Credit card (Demo)</span>
                </div>

                {/* UPI QR */}
                <div
                  onClick={() => setPaymentMethod('upi')}
                  className={cn(
                    'p-3.5 rounded-xl border cursor-pointer text-center transition-all',
                    paymentMethod === 'upi'
                      ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <QrCode className="w-6 h-6 text-teal-600 mx-auto mb-1" />
                  <span className="text-xs font-bold text-slate-800 block">Instant UPI QR Code</span>
                  <span className="text-[10px] text-slate-400">GPay, PhonePe, Paytm</span>
                </div>
              </div>

              {/* Dynamic UPI QR Code display */}
              {paymentMethod === 'upi' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center animate-in fade-in duration-150">
                  <p className="text-xs font-bold text-slate-800 mb-2">Scan & Pay via any UPI App</p>
                  <div className="inline-block p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=medistock@upi&pn=MediStock+Pharmacy&am=${total.toFixed(2)}&cu=USD`
                      )}`}
                      alt="UPI Payment QR Code"
                      className="w-36 h-36"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">
                    UPI ID: <span className="font-bold text-slate-800">medistock@upi</span>
                  </p>
                  <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                    ✓ Verified Pharmacy Payment Receiver
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Instructions for Pharmacist (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., call upon arrival, allergy alerts, substitute preferences..."
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none text-slate-800"
              />
            </div>
          </div>

          {/* Right Summary (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4 sticky top-24">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Order Review ({cartItems.length} items)
            </h3>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
              {cartItems.map((item) => (
                <div key={item.medicine_id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-slate-800">{item.medicine_name}</span>
                    <span className="text-[10px] text-slate-400 block">Qty: {item.quantity}</span>
                  </div>
                  <span className="font-bold text-slate-900">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (5%)</span>
                <span className="font-semibold text-slate-900">${tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-black text-slate-900">
                <span>Total Amount</span>
                <span className="text-teal-700 text-lg">${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={orderMutation.isPending || (hasRxItem && approvedPrescriptions.length === 0)}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {orderMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Placing Order in MySQL...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Place Order (${total.toFixed(2)})
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
