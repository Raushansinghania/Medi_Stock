import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Receipt,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  QrCode,
  DollarSign,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Printer,
  X,
  FileCheck2,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistPOSPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(5); // 5% standard GST
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi' | 'card'
  const [paidAmount, setPaidAmount] = useState('');
  const [completedSale, setCompletedSale] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // New Walk-in Customer Form state
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Fetch medicines with stock
  const { data: medicines = [], isLoading: isMedsLoading } = useQuery({
    queryKey: ['pos-medicines', searchTerm],
    queryFn: async () => {
      const res = await api.get(`/medicines?search=${encodeURIComponent(searchTerm)}`);
      return res.data;
    },
  });

  // Fetch registered customers
  const { data: customers = [] } = useQuery({
    queryKey: ['pos-customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
      return res.data;
    },
  });

  // Create Walk-in Customer Mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/customers', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
      setSelectedCustomerId(data.id);
      setIsCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to create customer');
    },
  });

  // POS Sale Checkout Mutation
  const saleMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/sales', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos-medicines'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard-badges'] });
      setCompletedSale(data);
      setCart([]);
      setDiscountPercent(0);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Checkout failed');
    },
  });

  // Handle barcode scanner input (e.g. scanning BATCH or ID)
  const handleBarcodeScan = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const term = barcodeInput.trim().toLowerCase();
    const matched = medicines.find(
      (m) =>
        (m.batch_number || '').toLowerCase() === term ||
        (m.id || '').toString() === term ||
        (m.medicine_name || '').toLowerCase().includes(term)
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
    } else {
      setErrorMsg(`No medicine matched barcode/batch: "${barcodeInput}"`);
    }
  };

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
          setErrorMsg(`Stock limit reached for ${med.medicine_name} (${med.quantity} available).`);
          return prev;
        }
        return prev.map((item) =>
          item.medicine_id === med.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          medicine_id: med.id,
          medicine_name: med.medicine_name,
          category: med.category,
          batch_number: med.batch_number || 'FEFO Auto',
          expiry_date: med.expiry_date,
          unit_price: Number(med.selling_price || 0),
          mrp: Number(med.mrp || med.selling_price || 0),
          available_stock: med.quantity,
          is_prescription_required: !!med.is_prescription_required,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (medicineId, newQty) => {
    setErrorMsg(null);
    const num = Number(newQty);
    if (isNaN(num) || num < 1) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.medicine_id === medicineId) {
          if (num > item.available_stock) {
            setErrorMsg(`Only ${item.available_stock} units available in stock for ${item.medicine_name}.`);
            return { ...item, quantity: item.available_stock };
          }
          return { ...item, quantity: num };
        }
        return item;
      })
    );
  };

  const removeFromCart = (medicineId) => {
    setCart((prev) => prev.filter((item) => item.medicine_id !== medicineId));
  };

  // Math Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountAmount = Math.round(((subtotal * Number(discountPercent)) / 100) * 100) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(((taxableAmount * Number(taxPercent)) / 100) * 100) / 100;
  const finalTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // Rx Requirement Check
  const hasRxItem = cart.some((item) => item.is_prescription_required);

  const handleCheckout = (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg('Cart is empty. Please add medicines to bill.');
      return;
    }

    const payload = {
      customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
      invoice_number: `INV-POS-${Date.now().toString().slice(-6)}`,
      sale_date: new Date().toISOString().slice(0, 10),
      items: cart.map((item) => ({
        medicine_id: item.medicine_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      discount: discountAmount,
      tax: taxAmount,
      payment_method: paymentMethod,
      paid_amount: paidAmount ? Number(paidAmount) : finalTotal,
    };

    saleMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-teal-600" />
            Point of Sale (POS) Billing & FEFO Dispensing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Barcode scanning, automated First-Expiry First-Out (FEFO) batch allocation, customer ledger, and thermal tax invoices.
          </p>
        </div>

        {/* Barcode Quick Scanner Form */}
        <form onSubmit={handleBarcodeScan} className="flex items-center gap-2">
          <div className="relative">
            <Barcode className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode / Batch..."
              className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none w-48 sm:w-60 text-slate-800"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
          >
            Scan
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:text-rose-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 2-Panel POS Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Medicine Search & Selector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search medicine name, brand, strength, or composition..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 shadow-sm"
            />
          </div>

          {/* Medicines Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Medicine Inventory ({medicines.length} Found)
              </span>
              <span className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded-full">
                FEFO Enabled
              </span>
            </div>

            {isMedsLoading ? (
              <div className="p-8 text-center">
                <LoadingSpinner />
                <p className="text-xs text-slate-400 mt-2">Loading catalogue...</p>
              </div>
            ) : medicines.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No medicines found matching "{searchTerm}".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {medicines.map((med) => {
                  const isOutOfStock = med.quantity <= 0;
                  return (
                    <div
                      key={med.id}
                      className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                        isOutOfStock
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-teal-400 hover:shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 leading-tight">
                            {med.medicine_name}
                          </h4>
                          {med.is_prescription_required ? (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-black text-[9px] border border-red-200 flex-shrink-0">
                              Rx
                            </span>
                          ) : null}
                        </div>

                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {med.category || 'General'} • {med.strength || 'Standard'}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="font-mono text-slate-500">
                            Batch: <span className="text-slate-800 font-medium">{med.batch_number || 'FEFO'}</span>
                          </span>
                          <span
                            className={`font-semibold ${
                              isOutOfStock
                                ? 'text-rose-600'
                                : med.quantity <= 15
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {isOutOfStock ? 'Out of stock' : `${med.quantity} in stock`}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900">₹{med.selling_price}</span>
                          {med.mrp && Number(med.mrp) > Number(med.selling_price) && (
                            <span className="text-[10px] text-slate-400 line-through ml-1.5">
                              ₹{med.mrp}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => addToCart(med)}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 text-xs font-bold border border-teal-200 transition"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Current Bill & Checkout (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col h-full">
            {/* Customer Selector & Quick Add */}
            <div className="pb-3 border-b border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-600" /> Customer / Patient:
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                >
                  + New Walk-in
                </button>
              </div>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                <option value="">Walk-in Cash Customer (General)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name} ({c.phone || c.email || `#${c.id}`})
                  </option>
                ))}
              </select>
            </div>

            {/* Prescription Warning Banner if cart contains Rx items */}
            {hasRxItem && (
              <div className="my-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-[11px] font-medium leading-tight">
                  Prescription Required for highlighted items. Confirm pharmacist verification before dispensing.
                </span>
              </div>
            )}

            {/* Cart Items Table */}
            <div className="flex-1 overflow-y-auto max-h-[300px] my-3 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  Your POS cart is currently empty.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.medicine_id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.medicine_name}</p>
                        {item.is_prescription_required && (
                          <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 rounded">Rx</span>
                        )}
                      </div>
                      <p className="text-[10px] text-teal-700 font-mono">
                        Batch: {item.batch_number} • ₹{item.unit_price} / unit
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.medicine_id, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.available_stock}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.medicine_id, e.target.value)}
                        className="w-10 text-center py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.medicine_id, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.medicine_id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right w-16">
                      <span className="text-xs font-bold text-slate-900">
                        ₹{(item.quantity * item.unit_price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Summary Calculations */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  Discount (%):
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-12 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-right text-xs"
                  />
                </span>
                <span className="font-semibold text-emerald-600">-₹{discountAmount.toFixed(2)}</span>
              </div>

              {/* GST Tax Rate */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  GST Tax ({taxPercent}%):
                  <select
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    className="px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% (Medicines)</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                  </select>
                </span>
                <span className="font-semibold text-slate-800">+₹{taxAmount.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900">Final Bill Amount:</span>
                <span className="text-xl font-black text-teal-700">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Payment Method</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: DollarSign },
                  { id: 'upi', label: 'UPI / QR', icon: QrCode },
                  { id: 'card', label: 'Card', icon: CreditCard },
                ].map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition ${
                        paymentMethod === pm.id
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic UPI QR Code Preview when UPI is selected */}
              {paymentMethod === 'upi' && (
                <div className="p-3 rounded-xl bg-slate-900 text-white text-center space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-teal-400">Scan UPI QR to Pay ₹{finalTotal}</p>
                  <div className="inline-block p-2 bg-white rounded-lg shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                        `upi://pay?pa=medistock@upi&pn=MediStockPharmacy&am=${finalTotal}&cu=INR`
                      )}`}
                      alt="UPI QR Code"
                      className="w-24 h-24 mx-auto"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">UPI ID: medistock@upi</p>
                </div>
              )}

              {/* Checkout Submit Button */}
              <button
                type="button"
                disabled={cart.length === 0 || saleMutation.isPending}
                onClick={handleCheckout}
                className="w-full mt-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                {saleMutation.isPending ? 'Processing FEFO Dispensing...' : `Complete Sale & Print Bill (₹${finalTotal})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Walk-in Customer Registration Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add Walk-in Customer</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newCustName.trim() || createCustomerMutation.isPending}
                onClick={() =>
                  createCustomerMutation.mutate({
                    customer_name: newCustName.trim(),
                    phone: newCustPhone.trim(),
                  })
                }
                className="px-4 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition"
              >
                {createCustomerMutation.isPending ? 'Saving...' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Invoice Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Sale Completed Successfully</h3>
              </div>
              <button onClick={() => setCompletedSale(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Tax Invoice Content */}
            <div id="pos-print-area" className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3 font-mono">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <h4 className="font-bold text-sm text-slate-900">MEDISTOCK PHARMACY</h4>
                <p className="text-[10px] text-slate-500">24/7 Healthcare ERP & Clinical Dispensary</p>
                <p className="text-[10px] text-slate-500">GSTIN: 27AABCM8291M1Z5 • Drug Lic: DL-MH-10294</p>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>Invoice: {completedSale.invoice_number}</span>
                <span>Date: {completedSale.sale_date}</span>
              </div>

              <div className="py-2 border-y border-dashed border-slate-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] text-slate-500">
                      <th>Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(completedSale.items || []).map((it, idx) => (
                      <tr key={idx} className="text-[11px]">
                        <td className="truncate max-w-[120px]">{it.medicine_name || `Medicine #${it.medicine_id}`}</td>
                        <td className="text-center">{it.quantity}</td>
                        <td className="text-right">₹{it.unit_price}</td>
                        <td className="text-right">₹{it.subtotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-right text-[11px]">
                <div>Subtotal: ₹{completedSale.subtotal}</div>
                {Number(completedSale.discount) > 0 && <div>Discount: -₹{completedSale.discount}</div>}
                <div>Tax (GST): ₹{completedSale.tax}</div>
                <div className="font-bold text-sm text-slate-900">Total Paid: ₹{completedSale.total_amount}</div>
                <div className="text-[10px] text-slate-500 uppercase">Payment: {completedSale.payment_method}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Thermal Receipt
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition"
              >
                New Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
