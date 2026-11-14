import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { updateQuantity, removeFromCart, clearCart } from '@/store/slices/cartSlice';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Pill,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CustomerCartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const cartItems = useSelector((state) => state.cart?.items || []);
  const subtotal = Math.round(cartItems.reduce((acc, item) => acc + item.subtotal, 0) * 100) / 100;
  const taxRate = 0.05; // 5%
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const discount = 0.0;
  const total = Math.round((subtotal + tax - discount) * 100) / 100;

  const hasRxItem = cartItems.some((item) => item.is_prescription_required);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Shopping Cart</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review selected medicines, check prescription requirements, and proceed to checkout
          </p>
        </div>
        {cartItems.length > 0 && (
          <button
            type="button"
            onClick={() => dispatch(clearCart())}
            className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" /> Clear All Items
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Your cart is empty</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Looks like you haven't added any prescription or OTC medicines to your cart yet.
          </p>
          <Link
            to="/customer/medicines"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            <Pill className="w-4 h-4" /> Browse Medicine Catalogue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cart Items List (8 Columns) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Prescription Alert Banner */}
            {hasRxItem && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Prescription Medication in Cart</h4>
                  <p className="text-amber-700 mt-0.5 leading-relaxed text-[11px]">
                    One or more items in your cart require a licensed physician's prescription. You will be able to select your approved prescription or upload a new one at checkout.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {cartItems.map((item) => (
                <div key={item.medicine_id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      <Pill className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{item.medicine_name}</h3>
                        {item.is_prescription_required && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Rx
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ${Number(item.unit_price).toFixed(2)} per unit {item.strength && `• ${item.strength}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6">
                    {/* Quantity Controls */}
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(
                            updateQuantity({
                              medicine_id: item.medicine_id,
                              quantity: item.quantity - 1,
                            })
                          )
                        }
                        className="p-1.5 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(
                            updateQuantity({
                              medicine_id: item.medicine_id,
                              quantity: item.quantity + 1,
                            })
                          )
                        }
                        className="p-1.5 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <span className="text-sm font-bold text-slate-900 w-16 text-right">
                      ${Number(item.subtotal).toFixed(2)}
                    </span>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => dispatch(removeFromCart(item.medicine_id))}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <Link
                to="/customer/medicines"
                className="font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
              >
                ← Continue Adding Medicines
              </Link>
            </div>
          </div>

          {/* Order Summary Card (4 Columns) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4 sticky top-24">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Order Pricing Summary
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated Sales Tax (5%)</span>
                <span className="font-semibold text-slate-900">${tax.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-600">
                <span>Promotional Discount</span>
                <span className="font-semibold">-$0.00</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm font-bold text-slate-900">
                <span>Total Payable</span>
                <span className="text-lg text-teal-700 font-black">${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/customer/checkout')}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              Proceed to Secure Checkout <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-[10px] text-slate-400 text-center leading-relaxed flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
              <span>Safe & compliant online pharmacy dispensation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
