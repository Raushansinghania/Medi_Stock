import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  ShieldAlert,
  Archive,
  Trash2,
  AlertCircle,
  Plus,
  Receipt,
  Pill,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inspectTarget, setInspectTarget] = useState(null);
  const [inspectionDisposition, setInspectionDisposition] = useState('approved_restock');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // New Return Modal State
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [invoiceLookup, setInvoiceLookup] = useState('');
  const [foundSale, setFoundSale] = useState(null);
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');

  const { data: returnsData = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-returns'],
    queryFn: async () => {
      const res = await api.get('/returns');
      return res.data;
    },
  });

  // Invoice Lookup Mutation
  const lookupSaleMutation = useMutation({
    mutationFn: async (invNum) => {
      const res = await api.get(`/sales?search=${encodeURIComponent(invNum.trim())}`);
      if (!res.data || res.data.length === 0) {
        throw new Error(`Invoice #${invNum} not found in sales ledger`);
      }
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

  // Create Return Mutation
  const createReturnMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/returns', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-returns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setIsProcessModalOpen(false);
      setFoundSale(null);
      setInvoiceLookup('');
      setReturnReason('');
      setStatusMsg({
        type: 'success',
        text: `Customer return recorded. Item quarantined under pending inspection.`,
      });
      setTimeout(() => setStatusMsg(null), 5000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to process return');
    },
  });

  // Inspect Return Mutation
  const inspectMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const res = await api.post(`/pharmacist/returns/${id}/inspect`, { status, notes });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-returns'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-telemetry'] });
      setInspectTarget(null);
      setInspectionNotes('');
      setStatusMsg({
        type: 'success',
        text: `Return inspection complete. Status: ${data.inspection_status}. ${
          data.inspection_status === 'approved_restock' ? 'Inventory restored safely.' : 'Items quarantined as discard.'
        }`,
      });
      setTimeout(() => setStatusMsg(null), 5000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || err.message });
      setTimeout(() => setStatusMsg(null), 5000);
    },
  });

  const handleInspectSubmit = (e) => {
    e.preventDefault();
    inspectMutation.mutate({
      id: inspectTarget.id,
      status: inspectionDisposition,
      notes: inspectionNotes,
    });
  };

  const handleCreateReturnSubmit = (e) => {
    e.preventDefault();
    if (!foundSale || !selectedMedicineId) return;

    createReturnMutation.mutate({
      sale_id: foundSale.id,
      medicine_id: Number(selectedMedicineId),
      quantity: Number(returnQty),
      reason: returnReason.trim() || 'Patient return / defect reported',
    });
  };

  const filteredReturns = returnsData.filter((r) => {
    const matchesSearch =
      !search ||
      r.medicine_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toString().includes(search);
    const matchesStatus = !statusFilter || r.inspection_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const selectedItemObj = foundSale?.items?.find((it) => it.medicine_id === Number(selectedMedicineId));
  const estimatedRefund = selectedItemObj ? Number(selectedItemObj.unit_price) * Number(returnQty) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-2">
            <RotateCcw className="w-3.5 h-3.5" /> Return & Quarantine Protocol
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Returns & Refunds Governance</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit returned merchandise, process customer refund claims, and authorize inventory re-entry post clinical inspection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProcessModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" /> Process Customer Return
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Messages */}
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quarantine Standard Banner */}
      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-950 leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Quarantine Protection:</strong> MediStock prohibits automatic restock of customer returns. Returned units are isolated under <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">pending_inspection</code> until authorized inspection confirms seal integrity. Damaged or opened goods are marked discarded and never re-enter sellable stock.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by medicine, customer, return ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Inspection Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none"
          >
            <option value="">All Inspection States</option>
            <option value="pending_inspection">Pending Inspection</option>
            <option value="approved_restock">Approved Restock</option>
            <option value="damaged_discarded">Damaged / Discarded</option>
          </select>
        </div>
      </div>

      {/* Returns Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <LoadingSpinner size="lg" text="Loading returns registry from MySQL..." />
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-40 text-amber-600" />
            <h3 className="font-bold text-slate-700 text-sm">No return records found</h3>
            <p className="text-xs text-slate-500 mt-1">Processed returns will populate here for clinical quarantine inspection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Medicine Item</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Refund ($)</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-center">Inspection Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">RET-{ret.id}</td>
                    <td className="py-3.5 px-4 font-mono text-teal-700">{ret.invoice_number || 'INV-' + ret.sale_id}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{ret.medicine_name}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700">{ret.quantity}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(ret.refund_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{ret.customer_name || 'Walk-in Customer'}</td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{ret.return_reason || ret.reason || '—'}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                          ret.inspection_status === 'approved_restock'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ret.inspection_status === 'damaged_discarded'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        )}
                      >
                        {ret.inspection_status ? ret.inspection_status.replace(/_/g, ' ').toUpperCase() : 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {ret.inspection_status === 'pending_inspection' ? (
                        <button
                          onClick={() => setInspectTarget(ret)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition"
                        >
                          Inspect
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Inspected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {inspectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Clinical Return Inspection – RET-{inspectTarget.id}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Examine medicine seal, packaging, and temperature condition before authorizing disposition.
            </p>

            <form onSubmit={handleInspectSubmit} className="space-y-4 mt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-800">{inspectTarget.medicine_name}</p>
                <p className="text-slate-500 mt-0.5">
                  Return Quantity: <span className="font-bold text-teal-700">{inspectTarget.quantity}</span> units • Refund: <span className="font-bold text-slate-900">{formatCurrency(inspectTarget.refund_amount)}</span>
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspection Disposition *</label>
                <select
                  value={inspectionDisposition}
                  onChange={(e) => setInspectionDisposition(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none"
                >
                  <option value="approved_restock">Approved for Restock (Seal Intact)</option>
                  <option value="damaged_discarded">Damaged / Discarded (Seal Broken / Tampered)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspection Notes</label>
                <textarea
                  rows="2"
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="e.g. Package inspected, batch verified, original blister intact."
                  className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectTarget(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inspectMutation.isPending}
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  Confirm Disposition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process New Return Modal */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full p-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Process Customer Return</h3>
              <button onClick={() => setIsProcessModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Lookup Form */}
            <div className="mt-4">
              <label className="block font-semibold text-slate-700 mb-1">Invoice Number *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. INV-2026-0001 or INV-ORD-..."
                  value={invoiceLookup}
                  onChange={(e) => setInvoiceLookup(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => lookupSaleMutation.mutate(invoiceLookup)}
                  disabled={lookupSaleMutation.isPending || !invoiceLookup.trim()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold flex-shrink-0 disabled:opacity-50"
                >
                  {lookupSaleMutation.isPending ? 'Searching...' : 'Lookup'}
                </button>
              </div>
            </div>

            {foundSale && (
              <form onSubmit={handleCreateReturnSubmit} className="space-y-4 mt-4 pt-3 border-t border-slate-100">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-800">
                    Invoice #{foundSale.invoice_number} • Date: {foundSale.sale_date}
                  </p>
                  <p className="text-slate-500">
                    Patient: {foundSale.customer_name || 'Walk-in'} • Total: ${Number(foundSale.total_amount).toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Medicine Item to Return</label>
                  <select
                    value={selectedMedicineId}
                    onChange={(e) => setSelectedMedicineId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none"
                  >
                    {(foundSale.items || []).map((it) => (
                      <option key={it.medicine_id} value={it.medicine_id}>
                        {it.medicine_name} – Purchased: {it.quantity} @ ${Number(it.unit_price).toFixed(2)}/unit
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Return Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedItemObj?.quantity || 100}
                      value={returnQty}
                      onChange={(e) => setReturnQty(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Refund Amount ($)</label>
                    <input
                      type="text"
                      disabled
                      value={`$${estimatedRefund.toFixed(2)}`}
                      className="w-full p-2 bg-slate-100 border border-slate-300 rounded-xl font-bold text-teal-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Return Reason</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adverse reaction, prescribed alternative, or seal defect"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setFoundSale(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 font-semibold"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={createReturnMutation.isPending}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs"
                  >
                    {createReturnMutation.isPending ? 'Processing...' : 'Submit to Quarantine'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
