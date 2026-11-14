import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Truck,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  AlertCircle,
  X,
  Edit,
  Trash2,
  Receipt,
  Eye,
  Building,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewSupplierId, setViewSupplierId] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  const [formData, setFormData] = useState({
    supplier_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    payment_terms: 'Net 30',
    status: 'active',
  });

  const { data: suppliers = [], isLoading, refetch } = useQuery({
    queryKey: ['suppliers', searchTerm],
    queryFn: async () => {
      const res = await api.get(`/suppliers?search=${encodeURIComponent(searchTerm)}`);
      return res.data;
    },
  });

  const { data: supplierDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['supplier-details', viewSupplierId],
    queryFn: async () => {
      if (!viewSupplierId) return null;
      const res = await api.get(`/suppliers/${viewSupplierId}`);
      return res.data;
    },
    enabled: !!viewSupplierId,
  });

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/suppliers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsAddModalOpen(false);
      resetForm();
      setStatusMsg({ type: 'success', text: 'Supplier registered successfully in MySQL!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to add supplier' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/suppliers/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setEditingSupplier(null);
      resetForm();
      setStatusMsg({ type: 'success', text: 'Supplier updated successfully in MySQL!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update supplier' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/suppliers/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setStatusMsg({ type: 'success', text: 'Supplier removed successfully!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete supplier' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  const resetForm = () => {
    setFormData({
      supplier_name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      gstin: '',
      payment_terms: 'Net 30',
      status: 'active',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (sup) => {
    setFormData({
      supplier_name: sup.supplier_name || '',
      contact_person: sup.contact_person || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      gstin: sup.gstin || '',
      payment_terms: sup.payment_terms || 'Net 30',
      status: sup.status || 'active',
    });
    setEditingSupplier(sup);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSupplier) {
      editMutation.mutate({ id: editingSupplier.id, payload: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete supplier '${name}'? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-teal-600" />
            Supplier & Procurement Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registered wholesale distributors, pharmaceutical vendors, and purchase history
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, contact, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200"
        >
          Refresh
        </button>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="lg" text="Loading suppliers from MySQL..." />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No suppliers registered yet</h3>
            <p className="text-xs text-slate-500 mt-1">Add a vendor to start recording purchase orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Supplier Name</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Phone / Email</th>
                  <th className="py-3.5 px-4 text-center">Orders</th>
                  <th className="py-3.5 px-4 text-right">Total Purchases</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{s.supplier_name}</div>
                      <div className="text-[11px] text-slate-400">GST: {s.gstin || 'Unregistered'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{s.contact_person || '—'}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{s.phone || '—'}</div>
                      <div className="text-[11px] text-slate-400">{s.email || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {s.total_orders || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${Number(s.total_purchases || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600">
                      ${Number(s.outstanding_balance || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.status || 'active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewSupplierId(s.id)}
                          title="View PO History"
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Supplier"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.supplier_name)}
                          title="Delete Supplier"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* PO History & Balance Modal */}
      {viewSupplierId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-teal-600" />
                  {supplierDetails?.supplier_name || 'Supplier Ledger'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Contact: {supplierDetails?.contact_person || 'N/A'} • Terms: {supplierDetails?.payment_terms || 'Net 30'}
                </p>
              </div>
              <button
                onClick={() => setViewSupplierId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="py-8 text-center">
                <LoadingSpinner text="Fetching PO records from database..." />
              </div>
            ) : supplierDetails ? (
              <div className="space-y-4">
                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Total Invoiced</span>
                    <span className="text-sm font-bold text-slate-900">
                      ${Number(supplierDetails.totalPurchases || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Settled / Paid</span>
                    <span className="text-sm font-bold text-emerald-600">
                      ${Number(supplierDetails.totalPaid || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Outstanding Balance</span>
                    <span className="text-sm font-bold text-amber-600">
                      ${Number(supplierDetails.outstandingBalance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Purchase Orders Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Purchase Orders & Invoices</h4>
                  {supplierDetails.purchases?.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-6">No purchase orders found for this vendor.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">PO Number</th>
                            <th className="py-2.5 px-3">Order Date</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {supplierDetails.purchases?.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{p.purchase_order_number}</td>
                              <td className="py-2 px-3 text-slate-500">{p.purchase_date?.slice(0, 10)}</td>
                              <td className="py-2 px-3">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  p.status === 'received' ? 'bg-emerald-50 text-emerald-700' :
                                  p.status === 'cancelled' ? 'bg-rose-50 text-rose-700' :
                                  'bg-amber-50 text-amber-700'
                                }`}>
                                  {p.status?.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                ${Number(p.total_amount || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewSupplierId(null)}
                className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {(isAddModalOpen || editingSupplier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingSupplier(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Health Logistics"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    placeholder="27AAACH2427D1Z6"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+1-555-0100"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="orders@supplier.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Advance">Advance Payment</option>
                    <option value="COD">Cash on Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows="2"
                  placeholder="Warehouse / Billing Address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingSupplier(null);
                  }}
                  className="px-3 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending || editMutation.isPending}
                  className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow disabled:opacity-50"
                >
                  {addMutation.isPending || editMutation.isPending
                    ? 'Saving...'
                    : editingSupplier
                    ? 'Update Supplier'
                    : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
