import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Pill,
  ShieldAlert,
  ArrowRight,
  X,
  FileCheck2,
  Trash2,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistReturnsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // New Return Form State
  const [invoiceLookup, setInvoiceLookup] = useState('');
  const [foundSale, setFoundSale] = useState(null);
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');

  // Inspection Decision State
  const [activeInspectReturn, setActiveInspectReturn] = useState(null);
  const [inspectionAction, setInspectionAction] = useState('restock'); // 'restock' | 'discard'
  const [inspectionNotes, setInspectionNotes] = useState('');

  // Fetch Returns
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['pharmacist-returns'],
    queryFn: async () => {
      const res = await api.get('/returns');
      return res.data;
    },
  });

  // Lookup Sale for Return
  const lookupSaleMutation = useMutation({
    mutationFn: async (invNum) => {
      const res = await api.get(`/sales?search=${encodeURIComponent(invNum.trim())}`);
      if (!res.data || res.data.length === 0) {
        throw new Error(`Invoice #${invNum} not found`);
      }
      // Get detailed sale with items
      const detailRes = await api.get(`/sales/${res.data[0].id}`);
      return detailRes.data;
    },
    onSuccess: (data) => {
      setFoundSale(data);
      if (data.items && data.items.length > 0) {
        setSelectedMedicineId(data.items[0].medicine_id);
      }
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Invoice not found');
      setFoundSale(null);
    },
  });

  // Submit Initial Return (Enters Pending Inspection)
  const createReturnMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/returns', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-returns'] });
      setStatusMsg(`Return recorded for Sale #${foundSale?.invoice_number}. Awaiting clinical inspection.`);
      setIsProcessModalOpen(false);
      setFoundSale(null);
      setInvoiceLookup('');
      setReturnReason('');
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to process return');
    },
  });

  // Pharmacist Inspection Mutation
  const inspectMutation = useMutation({
    mutationFn: async ({ id, action, inspection_notes }) => {
      const res = await api.post(`/pharmacist/returns/${id}/inspect`, {
        action,
        inspection_notes,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-returns'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard'] });
      setStatusMsg(`Return #${data.id} inspection complete. Status: ${data.inspection_status.toUpperCase()}.`);
      setActiveInspectReturn(null);
      setInspectionNotes('');
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to complete inspection');
    },
  });

  const handleLookup = (e) => {
    e.preventDefault();
    if (!invoiceLookup.trim()) return;
    lookupSaleMutation.mutate(invoiceLookup);
  };

  const handleCreateReturnSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!foundSale) {
      setErrorMsg('Please lookup a valid sale invoice first.');
      return;
    }
    if (!selectedMedicineId) {
      setErrorMsg('Please select a medicine item from this invoice.');
      return;
    }
    if (returnQty < 1) {
      setErrorMsg('Return quantity must be at least 1.');
      return;
    }

    createReturnMutation.mutate({
      sale_id: foundSale.id,
      medicine_id: Number(selectedMedicineId),
      quantity: Number(returnQty),
      return_reason: returnReason.trim() || 'Patient return',
    });
  };

  const handleInspectSubmit = (e) => {
    e.preventDefault();
    if (!activeInspectReturn) return;
    inspectMutation.mutate({
      id: activeInspectReturn.id,
      action: inspectionAction,
      inspection_notes: inspectionNotes.trim() || undefined,
    });
  };

  const filteredReturns = returns.filter((r) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.invoice_number || '').toLowerCase().includes(q) ||
      (r.medicine_name || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-teal-600" />
            Medicine Returns & Quarantine Inspection
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mandatory clinical inspection before restock. Defective or compromised units are safely discarded with stock movement logging.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsProcessModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Process New Return
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search return by invoice or medicine..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
          />
        </div>
        <span className="text-xs text-slate-500 hidden sm:block">
          Total Returns on File: <strong className="text-slate-800">{returns.length}</strong>
        </span>
      </div>

      {/* Returns Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-400 mt-2">Loading returns history...</p>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700">No returns on record</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Return ID</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Medicine Returned</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Inspection Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredReturns.map((r) => {
                  const status = r.inspection_status || 'approved_restock';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">#{r.id}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{r.invoice_number}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{r.medicine_name}</td>
                      <td className="py-3 px-4 text-center font-bold text-teal-700">{r.quantity}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-[150px] truncate">{r.return_reason || 'N/A'}</td>
                      <td className="py-3 px-4">
                        {status === 'pending_inspection' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            PENDING INSPECTION
                          </span>
                        ) : status === 'approved_restock' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            APPROVED RESTOCK
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            DAMAGED (DISCARDED)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {status === 'pending_inspection' ? (
                          <button
                            type="button"
                            onClick={() => setActiveInspectReturn(r)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 font-semibold border border-teal-200 transition"
                          >
                            Inspect Return
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Classified</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Process Return Modal */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Process Medicine Return</h3>
              <button onClick={() => setIsProcessModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Step 1: Lookup Invoice */}
            <form onSubmit={handleLookup} className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                1. Lookup Original Bill Invoice # *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoiceLookup}
                  onChange={(e) => setInvoiceLookup(e.target.value)}
                  placeholder="e.g. INV-173140..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={lookupSaleMutation.isPending}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
                >
                  {lookupSaleMutation.isPending ? 'Searching...' : 'Lookup'}
                </button>
              </div>
            </form>

            {/* Step 2: Sale Found Details */}
            {foundSale && (
              <form onSubmit={handleCreateReturnSubmit} className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-[11px] text-teal-950 space-y-1">
                  <p><strong>Invoice Found:</strong> {foundSale.invoice_number}</p>
                  <p><strong>Customer:</strong> {foundSale.customer_name || 'Walk-in Patient'}</p>
                  <p><strong>Date:</strong> {foundSale.sale_date}</p>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">2. Select Returned Medicine *</label>
                  <select
                    value={selectedMedicineId}
                    onChange={(e) => setSelectedMedicineId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800 font-medium"
                  >
                    {(foundSale.items || []).map((it) => (
                      <option key={it.medicine_id} value={it.medicine_id}>
                        {it.medicine_name} (Purchased: {it.quantity} @ ₹{it.unit_price})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Return Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={returnQty}
                      onChange={(e) => setReturnQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Return Reason *</label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g. Broken seal, wrong item"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsProcessModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createReturnMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition"
                  >
                    {createReturnMutation.isPending ? 'Logging...' : 'Submit Return for Inspection'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Pharmacist Inspection Modal */}
      {activeInspectReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Clinical Inspection: Return #{activeInspectReturn.id}
              </h3>
              <button onClick={() => setActiveInspectReturn(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><strong>Medicine:</strong> {activeInspectReturn.medicine_name}</p>
              <p><strong>Quantity:</strong> {activeInspectReturn.quantity} Units</p>
              <p><strong>Customer Reason:</strong> {activeInspectReturn.return_reason}</p>
            </div>

            <form onSubmit={handleInspectSubmit} className="space-y-3 text-xs">
              <label className="font-bold text-slate-700 block">Pharmacist Classification:</label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInspectionAction('restock')}
                  className={`p-3 rounded-xl border text-left transition ${
                    inspectionAction === 'restock'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold block">✓ Safe to Restock</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Unopened box, intact foil, proper storage
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectionAction('discard')}
                  className={`p-3 rounded-xl border text-left transition ${
                    inspectionAction === 'discard'
                      ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold block text-rose-700">✕ Damaged / Discard</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Broken seal, temperature breach, discard safely
                  </span>
                </button>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Inspection Notes *</label>
                <input
                  type="text"
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="e.g. Visual inspection passed, blister foil intact"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveInspectReturn(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inspectMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition"
                >
                  {inspectMutation.isPending ? 'Saving...' : 'Finalize Classification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
