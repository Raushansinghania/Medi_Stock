import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  ShoppingCart,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  PackageCheck,
  Calendar,
  Truck,
  RefreshCw,
  FileText,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  // Form state for creating PO
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [poStatus, setPoStatus] = useState('ordered'); // 'ordered' or 'received'
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ medicine_id: '', quantity: 50, unit_cost: 3.5, batch_number: '', expiry_date: '' }]);

  // State for receiving goods modal
  const [receiveBatchItems, setReceiveBatchItems] = useState([]);

  const { data: purchases = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['purchases', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/purchases?${params.toString()}`);
      return res.data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/suppliers');
      return res.data;
    },
  });

  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines-all'],
    queryFn: async () => {
      const res = await api.get('/medicines?limit=200');
      return res.data;
    },
  });

  // Purchase details query
  const { data: purchaseDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['purchase-detail', selectedPurchase?.id],
    queryFn: async () => {
      if (!selectedPurchase) return null;
      const res = await api.get(`/purchases/${selectedPurchase.id}`);
      return res.data;
    },
    enabled: !!selectedPurchase,
  });

  // Create Purchase Mutation
  const addPurchaseMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/purchases', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setIsModalOpen(false);
      setSupplierId('');
      setInvoiceNumber('');
      setItems([{ medicine_id: '', quantity: 50, unit_cost: 3.5, batch_number: '', expiry_date: '' }]);
      setStatusMsg({
        type: 'success',
        text: data.status === 'received'
          ? 'Purchase order recorded and stock increased in MySQL!'
          : `Purchase order created with status '${data.status}'. Stock will update upon confirmed receipt.`,
      });
      setTimeout(() => setStatusMsg(null), 5000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || err.message });
      setTimeout(() => setStatusMsg(null), 5000);
    },
  });

  // Receive Goods Mutation
  const receiveGoodsMutation = useMutation({
    mutationFn: async ({ id, itemsData }) => {
      const res = await api.post(`/purchases/${id}/receive`, { items: itemsData });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setReceiveTarget(null);
      setStatusMsg({ type: 'success', text: 'Goods receipt confirmed! Inventory stock and batches updated in MySQL.' });
      setTimeout(() => setStatusMsg(null), 5000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || err.message });
      setTimeout(() => setStatusMsg(null), 5000);
    },
  });

  const handleAddItemRow = () => {
    setItems([...items, { medicine_id: '', quantity: 20, unit_cost: 2.0, batch_number: '', expiry_date: '' }]);
  };

  const handleRemoveItemRow = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...items];
    updated[idx][field] = val;
    setItems(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.some((i) => !i.medicine_id)) {
      setStatusMsg({ type: 'error', text: 'Please select a medicine for all purchase rows' });
      return;
    }
    addPurchaseMutation.mutate({
      supplier_id: supplierId ? Number(supplierId) : null,
      invoice_number: invoiceNumber || `PUR-${Date.now()}`,
      purchase_date: purchaseDate,
      status: poStatus,
      tax: Number(tax) || 0,
      notes,
      items: items.map((i) => ({
        medicine_id: Number(i.medicine_id),
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
        batch_number: i.batch_number || null,
        expiry_date: i.expiry_date || null,
      })),
    });
  };

  const openReceiveModal = async (po) => {
    setReceiveTarget(po);
    try {
      const res = await api.get(`/purchases/${po.id}`);
      const poItems = res.data.items || [];
      setReceiveBatchItems(
        poItems.map((item) => ({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          quantity: item.quantity,
          batch_number: item.batch_number || `BATCH-PO${po.id}-${Math.floor(1000 + Math.random() * 9000)}`,
          expiry_date: item.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        }))
      );
    } catch {
      setReceiveBatchItems([]);
    }
  };

  const handleReceiveSubmit = (e) => {
    e.preventDefault();
    receiveGoodsMutation.mutate({
      id: receiveTarget.id,
      itemsData: receiveBatchItems,
    });
  };

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      !search ||
      p.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier_name?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <ShoppingCart className="w-3.5 h-3.5" /> Procurement & Supply Chain
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Orders & Inbound Goods</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create supplier purchase orders, track procurement lifecycle, and atomically receive stock into inventory.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Purchase Order
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number or distributor..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
          >
            <option value="">All PO Statuses</option>
            <option value="received">Received (In Stock)</option>
            <option value="ordered">Ordered (Awaiting Goods)</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => refetch()}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" message="Loading purchase records..." />
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No purchase records found</h3>
            <p className="text-xs text-slate-500 mt-1">Create purchase orders from verified suppliers to restock medicines.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Items Count</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {p.invoice_number}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 leading-tight">{p.supplier_name || 'Independent Vendor'}</p>
                      <p className="text-xs text-slate-400">{p.contact_person || 'N/A'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {p.purchase_date ? new Date(p.purchase_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {p.total_items || 1} line item(s)
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatCurrency(p.total_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === 'received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'ordered'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                            : p.status === 'cancelled'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {p.status ? p.status.replace('_', ' ').toUpperCase() : 'RECEIVED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status !== 'received' && p.status !== 'cancelled' && (
                          <button
                            onClick={() => openReceiveModal(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
                            title="Confirm Goods Receipt into Stock"
                          >
                            <PackageCheck className="w-3.5 h-3.5" /> Receive Goods
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPurchase(p)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Purchase Order */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900">Create Supplier Purchase Order</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name} ({s.contact_person || 'Vendor'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice / PO Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Leave blank for auto INV-PO"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Order Date</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={poStatus}
                    onChange={(e) => setPoStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
                  >
                    <option value="ordered">Ordered (Awaiting Goods Receipt)</option>
                    <option value="received">Received (Direct Stock Inflow)</option>
                    <option value="draft">Draft Order</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Applicable Tax ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Line Items</h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Another Medicine
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Item #{idx + 1}</span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-medium text-slate-500">Medicine *</label>
                          <select
                            value={item.medicine_id}
                            onChange={(e) => handleItemChange(idx, 'medicine_id', e.target.value)}
                            required
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500 bg-white"
                          >
                            <option value="">-- Choose Medicine --</option>
                            {medicines.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.medicine_name} ({m.category || 'General'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-500">Quantity *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-500">Unit Cost ($) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.unit_cost}
                            onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>

                      {poStatus === 'received' && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500">Batch Number</label>
                            <input
                              type="text"
                              value={item.batch_number}
                              onChange={(e) => handleItemChange(idx, 'batch_number', e.target.value)}
                              placeholder="Auto-generated if empty"
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500">Expiry Date</label>
                            <input
                              type="date"
                              value={item.expiry_date}
                              onChange={(e) => handleItemChange(idx, 'expiry_date', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addPurchaseMutation.isLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
                >
                  {addPurchaseMutation.isLoading ? 'Submitting...' : 'Submit Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Goods Receipt */}
      {receiveTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Confirm Inbound Goods Receipt #{receiveTarget.invoice_number}
              </h2>
              <button onClick={() => setReceiveTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Confirm batch numbers and expiry dates for the items delivered. This will atomically update warehouse inventory in MySQL.
            </p>

            <form onSubmit={handleReceiveSubmit} className="mt-4 space-y-4">
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {receiveBatchItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{item.medicine_name}</span>
                      <span>{item.quantity} units</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">Batch Number *</label>
                        <input
                          type="text"
                          required
                          value={item.batch_number}
                          onChange={(e) => {
                            const updated = [...receiveBatchItems];
                            updated[idx].batch_number = e.target.value;
                            setReceiveBatchItems(updated);
                          }}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600">Expiry Date *</label>
                        <input
                          type="date"
                          required
                          value={item.expiry_date}
                          onChange={(e) => {
                            const updated = [...receiveBatchItems];
                            updated[idx].expiry_date = e.target.value;
                            setReceiveBatchItems(updated);
                          }}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReceiveTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiveGoodsMutation.isLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
                >
                  {receiveGoodsMutation.isLoading ? 'Receiving...' : 'Confirm Inbound Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Purchase Details */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Purchase Invoice #{selectedPurchase.invoice_number}
              </h2>
              <button onClick={() => setSelectedPurchase(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Supplier:</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedPurchase.supplier_name}</p>
                <p className="text-slate-500">{selectedPurchase.contact_person} • {selectedPurchase.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-medium">Total Invoiced:</p>
                <p className="font-bold text-teal-700 text-lg mt-0.5">{formatCurrency(selectedPurchase.total_amount)}</p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedPurchase.status?.toUpperCase() || 'RECEIVED'}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">Itemized Goods Inflow</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Medicine</th>
                      <th className="py-2.5 px-3">Batch</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseDetail?.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.medicine_name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{item.batch_number || item.med_batch_number || 'N/A'}</td>
                        <td className="py-2.5 px-3">{item.quantity}</td>
                        <td className="py-2.5 px-3">{formatCurrency(item.unit_cost)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end">
              <button
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
