import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  User,
  CreditCard,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Printer,
  X,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function POSBillingPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(5); // 5% default tax
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [completedSale, setCompletedSale] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch medicines
  const { data: medicines = [], isLoading: isMedsLoading } = useQuery({
    queryKey: ['medicines', searchTerm],
    queryFn: async () => {
      const res = await api.get(`/medicines?search=${encodeURIComponent(searchTerm)}`);
      return res.data;
    },
  });

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    },
  });

  // Create Sale Mutation
  const saleMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/sales', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setCompletedSale(data);
      setCart([]);
      setDiscount(0);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Checkout failed');
    },
  });

  const addToCart = (med) => {
    if (med.quantity <= 0) {
      setErrorMsg(`'${med.medicine_name}' is currently out of stock.`);
      return;
    }
    setErrorMsg(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.medicine_id === med.id);
      if (existing) {
        if (existing.quantity >= med.quantity) {
          setErrorMsg(`Cannot add more than available stock (${med.quantity}).`);
          return prev;
        }
        return prev.map((item) =>
          item.medicine_id === med.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        );
      }
      return [
        ...prev,
        {
          medicine_id: med.id,
          medicine_name: med.medicine_name,
          unit_price: Number(med.selling_price || 0),
          quantity: 1,
          availableStock: med.quantity,
          subtotal: Number(med.selling_price || 0),
        },
      ];
    });
  };

  const updateQuantity = (medId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.medicine_id === medId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.availableStock) {
              setErrorMsg(`Requested quantity exceeds available stock (${item.availableStock}).`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              subtotal: Math.round(newQty * item.unit_price * 100) / 100,
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (medId) => {
    setCart((prev) => prev.filter((item) => item.medicine_id !== medId));
  };

  // Computations
  const subtotal = Math.round(cart.reduce((acc, item) => acc + item.subtotal, 0) * 100) / 100;
  const numDiscount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const taxableAmount = Math.max(0, subtotal - numDiscount);
  const tax = Math.round((taxableAmount * (Number(taxRate) / 100)) * 100) / 100;
  const totalAmount = Math.round((taxableAmount + tax) * 100) / 100;

  const handleCheckout = () => {
    if (cart.length === 0) {
      setErrorMsg('Cart is empty. Please select medicines to proceed.');
      return;
    }

    saleMutation.mutate({
      customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
      discount: numDiscount,
      tax,
      payment_method: paymentMethod,
      items: cart.map((i) => ({
        medicine_id: i.medicine_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">POS & Billing Checkout</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time counter sales with immediate MySQL inventory deduction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-teal-50 text-teal-700 font-semibold rounded-full border border-teal-200">
            ACID Transaction Protected
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* POS Grid: Left for Catalog, Right for Bill Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Catalog (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search medicine catalog by name, brand, or batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Available Medicines in Stock
            </h3>

            {isMedsLoading ? (
              <div className="py-8 text-center">
                <LoadingSpinner size="md" text="Loading stock..." />
              </div>
            ) : medicines.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No medicines found matching criteria.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {medicines.map((med) => {
                  const outOfStock = med.quantity <= 0;
                  return (
                    <div
                      key={med.id}
                      onClick={() => !outOfStock && addToCart(med)}
                      className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between ${
                        outOfStock
                          ? 'opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed'
                          : 'bg-white hover:border-teal-500 hover:shadow-sm cursor-pointer border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase text-slate-400">
                            {med.category || 'General'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              outOfStock
                                ? 'bg-red-50 text-red-600'
                                : med.quantity <= 10
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {outOfStock ? 'Out of Stock' : `${med.quantity} in stock`}
                          </span>
                        </div>
                        <h4 className="font-semibold text-xs text-slate-800 mt-1">{med.medicine_name}</h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Batch: {med.batch_number || 'N/A'}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">
                          ${Number(med.selling_price || 0).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          disabled={outOfStock}
                          className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Cart & Billing (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-sm">Customer Order Cart</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                {cart.length} items
              </span>
            </div>

            {/* Customer Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="">Walk-in Customer (General)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name} ({c.phone || c.email || 'No contact'})
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  Cart is empty. Click items on the left to add.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.medicine_id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                  >
                    <div className="flex-1 mr-2">
                      <p className="font-semibold text-slate-800">{item.medicine_name}</p>
                      <p className="text-[11px] text-slate-500">
                        ${item.unit_price.toFixed(2)} × {item.quantity} = ${item.subtotal.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.medicine_id, -1)}
                        className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-slate-800">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.medicine_id, 1)}
                        className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.medicine_id)}
                        className="p-1 text-red-500 hover:text-red-700 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600 gap-2">
                <span>Discount ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-20 px-2 py-1 text-right text-xs border border-slate-200 rounded focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-slate-600 gap-2">
                <span>Tax Rate (%)</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-20 px-2 py-1 text-right text-xs border border-slate-200 rounded focus:outline-none"
                />
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Tax Amount</span>
                <span className="font-semibold text-slate-800">${tax.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Grand Total</span>
                <span className="text-teal-600">${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'card', 'upi'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1.5 text-xs font-semibold rounded-lg uppercase border transition-colors ${
                      paymentMethod === method
                        ? 'bg-teal-600 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkout Action */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || saleMutation.isPending}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saleMutation.isPending ? 'Processing Transaction...' : `Complete Sale • $${totalAmount.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Completed Sale Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Sale Completed Successfully!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Invoice #{completedSale.invoice_number} recorded in MySQL with stock deduction.
            </p>

            <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-semibold text-slate-800">{completedSale.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-800">{completedSale.sale_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Paid:</span>
                <span className="font-bold text-teal-600">${Number(completedSale.total_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span className="uppercase font-semibold text-slate-800">{completedSale.payment_method}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow"
              >
                Start New Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
