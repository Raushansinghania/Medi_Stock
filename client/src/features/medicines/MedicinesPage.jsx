import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Pill,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  SlidersHorizontal,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Power,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function MedicinesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearch(q);
      setPage(1);
    }
  }, [searchParams]);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  // New / Edit medicine form state
  const initialForm = {
    medicine_name: '',
    generic_name: '',
    category: 'Antibiotics',
    manufacturer: '',
    batch_number: '',
    dosage_form: 'Tablet',
    strength: '500mg',
    composition: '',
    description: '',
    is_prescription_required: 0,
    quantity: 50,
    purchase_price: 5.0,
    selling_price: 10.0,
    mrp: 12.0,
    discount_percent: 0,
    expiry_date: '',
    is_active: 1,
  };

  const [formData, setFormData] = useState(initialForm);

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data;
    },
  });

  // Fetch Medicines
  const {
    data: medicineResponse,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['medicines', search, selectedCategory, lowStockOnly, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory) params.append('category', selectedCategory);
      if (lowStockOnly) params.append('lowStock', 'true');
      params.append('page', page);
      params.append('limit', limit);
      const res = await api.get(`/medicines?${params.toString()}`);
      return res;
    },
  });

  const medicines = medicineResponse?.data || [];
  const pagination = medicineResponse?.pagination || { page: 1, totalPages: 1, totalDocs: medicines.length };

  // Add Medicine Mutation
  const addMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/medicines', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setIsAddModalOpen(false);
      setFormData(initialForm);
      setStatusMsg({ type: 'success', text: 'Medicine created successfully in MySQL database!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to add medicine' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  // Edit Medicine Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/medicines/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setEditTarget(null);
      setStatusMsg({ type: 'success', text: 'Medicine updated successfully!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update medicine' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  // Toggle Active / Deactivate Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const res = await api.put(`/medicines/${id}`, { is_active });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      setStatusMsg({
        type: 'success',
        text: `Medicine '${data.medicine_name}' marked as ${data.is_active ? 'ACTIVE' : 'INACTIVE'}.`,
      });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to change status' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  // Delete Medicine Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/medicines/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setStatusMsg({ type: 'success', text: 'Medicine record deleted from MySQL.' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete medicine' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  // Stock Adjustment Mutation
  const adjustMutation = useMutation({
    mutationFn: async ({ id, adjustment, reason }) => {
      const res = await api.post(`/medicines/${id}/adjust-stock`, { adjustment, reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setAdjustTarget(null);
      setAdjustAmount('');
      setAdjustReason('');
      setStatusMsg({ type: 'success', text: 'Stock adjusted and immutable movement recorded!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Stock adjustment failed' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  const handleOpenAdd = () => {
    setFormData(initialForm);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (med) => {
    setEditTarget(med);
    setFormData({
      medicine_name: med.medicine_name || '',
      generic_name: med.generic_name || '',
      category: med.category || 'Antibiotics',
      manufacturer: med.manufacturer || '',
      batch_number: med.batch_number || '',
      dosage_form: med.dosage_form || 'Tablet',
      strength: med.strength || '',
      composition: med.composition || '',
      description: med.description || '',
      is_prescription_required: med.is_prescription_required ? 1 : 0,
      quantity: med.quantity || 0,
      purchase_price: Number(med.purchase_price || 0),
      selling_price: Number(med.selling_price || 0),
      mrp: Number(med.mrp || med.selling_price || 0),
      discount_percent: Number(med.discount_percent || 0),
      expiry_date: med.expiry_date ? med.expiry_date.slice(0, 10) : '',
      is_active: med.is_active !== undefined ? med.is_active : 1,
    });
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editTarget) return;
    updateMutation.mutate({ id: editTarget.id, data: formData });
  };

  const handleDelete = (med) => {
    if (window.confirm(`Are you sure you want to permanently delete '${med.medicine_name}'?`)) {
      deleteMutation.mutate(med.id);
    }
  };

  const handleAdjustSubmit = (e) => {
    e.preventDefault();
    if (!adjustTarget) return;
    adjustMutation.mutate({
      id: adjustTarget.id,
      adjustment: Number(adjustAmount),
      reason: adjustReason,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <Pill className="w-3.5 h-3.5" /> Formulary Master Catalog
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Medicine Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure pharmaceutical master records, manage strengths, pricing, prescription policies, and active states.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Add Formulation
          </button>
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs"
            title="Refresh list"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={cn(
            'p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium',
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          )}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search brand, generic, manufacturer, batch..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-transparent border-none text-xs text-slate-800 focus:outline-none w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.category_name}>
                {c.category_name}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle */}
          <button
            onClick={() => {
              setLowStockOnly(!lowStockOnly);
              setPage(1);
            }}
            className={cn(
              'text-xs px-3 py-2 rounded-xl border font-semibold inline-flex items-center gap-1.5 transition',
              lowStockOnly
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Low Stock Only
          </button>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <LoadingSpinner size="lg" text="Loading medicines catalog from MySQL..." />
          </div>
        ) : medicines.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Pill className="w-12 h-12 mx-auto mb-2 opacity-40 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-700">No medicines found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or register a new medicine.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Medicine & Generic Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Strength / Form</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4 text-right">Cost Price</th>
                  <th className="py-3 px-4 text-right">Retail (MRP)</th>
                  <th className="py-3 px-4 text-center">Policy</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicines.map((med) => {
                  const isLow = Number(med.quantity) <= 10;
                  const isActive = med.is_active !== 0;
                  return (
                    <tr key={med.id} className={cn('hover:bg-slate-50/70 transition', !isActive && 'opacity-60 bg-slate-50/40')}>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{med.medicine_name}</p>
                        {med.generic_name && (
                          <p className="text-[11px] text-teal-700 font-medium">{med.generic_name}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {med.manufacturer || 'General'} • Batch: {med.batch_number || 'N/A'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {med.category || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <p className="font-semibold text-slate-800">{med.dosage_form || 'Tablet'}</p>
                        <p className="text-[10px] text-slate-500">{med.strength || 'Standard'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
                            med.quantity === 0
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : isLow
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800'
                          )}
                        >
                          {med.quantity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        ${Number(med.purchase_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ${Number(med.selling_price || 0).toFixed(2)}
                        {med.mrp && Number(med.mrp) > Number(med.selling_price) && (
                          <span className="block text-[10px] text-slate-400 font-normal line-through">
                            MRP ${Number(med.mrp).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {med.is_prescription_required ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Rx Req.
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-600">
                            OTC
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: med.id, is_active: isActive ? 0 : 1 })}
                          title={isActive ? 'Click to deactivate' : 'Click to activate'}
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold transition inline-flex items-center gap-1',
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700'
                              : 'bg-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                          )}
                        >
                          <Power className="w-2.5 h-2.5" /> {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setViewTarget(med)}
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                            title="View formulation details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(med)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                            title="Edit medicine formulation"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setAdjustTarget(med);
                              setAdjustAmount('10');
                            }}
                            className="px-2 py-1 text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition"
                            title="Adjust stock balance"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => handleDelete(med)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete medicine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.totalDocs} formulations)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Formulation Modal */}
      {(isAddModalOpen || editTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editTarget ? `Edit Formulation: ${editTarget.medicine_name}` : 'Register New Formulation'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditTarget(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editTarget ? handleEditSubmit : handleAddSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paracetamol 500mg"
                    value={formData.medicine_name}
                    onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Generic Name / Molecule</label>
                  <input
                    type="text"
                    placeholder="e.g. Acetaminophen"
                    value={formData.generic_name}
                    onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.category_name}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={formData.dosage_form}
                    onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="Drops">Drops</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Strength</label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg, 10ml"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. Pfizer, GSK, Abbott"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Batch #</label>
                  <input
                    type="text"
                    placeholder="e.g. BATCH-2026-01"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Composition / Active Ingredients</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg + Caffeine 30mg"
                  value={formData.composition}
                  onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clinical Description & Indications</label>
                <textarea
                  rows="2"
                  placeholder="Clinical usage instructions, indications and contraindications..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cost Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Retail Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MRP ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batch Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.is_prescription_required === 1}
                      onChange={(e) => setFormData({ ...formData, is_prescription_required: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Requires Doctor's Prescription (Rx)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditTarget(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow disabled:opacity-50"
                >
                  {addMutation.isPending || updateMutation.isPending ? 'Committing to MySQL...' : 'Save Formulation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">{viewTarget.medicine_name}</h3>
              </div>
              <button onClick={() => setViewTarget(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mt-4 text-slate-700">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Generic Name</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{viewTarget.generic_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Category</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{viewTarget.category || 'General'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Dosage Form & Strength</span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {viewTarget.dosage_form || 'Tablet'} • {viewTarget.strength || 'Standard'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Manufacturer</span>
                  <p className="font-semibold text-slate-900 mt-0.5">{viewTarget.manufacturer || 'General'}</p>
                </div>
              </div>

              {viewTarget.composition && (
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                  <span className="text-[10px] uppercase font-bold text-teal-800">Composition</span>
                  <p className="text-slate-800 mt-0.5">{viewTarget.composition}</p>
                </div>
              )}

              {viewTarget.description && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Clinical Overview</span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">{viewTarget.description}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Available Stock</span>
                  <p className="text-base font-bold text-teal-700 mt-0.5">{viewTarget.quantity} units</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cost Price</span>
                  <p className="text-base font-bold text-slate-700 mt-0.5">${Number(viewTarget.purchase_price || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Retail Price</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">${Number(viewTarget.selling_price || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setViewTarget(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Adjust Stock Level</h3>
              <button onClick={() => setAdjustTarget(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 mt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-800">{adjustTarget.medicine_name}</p>
                <p className="text-slate-500 mt-0.5">
                  Current Stock: <span className="font-bold text-teal-600">{adjustTarget.quantity}</span> units
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Adjustment Delta (Positive for stock-in, Negative for deduction)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 10 or -5"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mandatory Reason / Notes</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Periodic physical stock audit reconciliation"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-3 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustMutation.isPending}
                  className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow disabled:opacity-50"
                >
                  {adjustMutation.isPending ? 'Adjusting...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
