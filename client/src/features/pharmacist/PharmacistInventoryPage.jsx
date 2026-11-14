import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Boxes,
  Search,
  Filter,
  Plus,
  Minus,
  AlertTriangle,
  Layers,
  Calendar,
  CheckCircle2,
  X,
  RotateCcw,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistInventoryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustModalMed, setAdjustModalMed] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch medicines with batch summaries
  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['pharmacist-inventory', searchTerm],
    queryFn: async () => {
      const res = await api.get(`/medicines?search=${encodeURIComponent(searchTerm)}`);
      return res.data;
    },
  });

  // Adjust Stock Mutation
  const adjustMutation = useMutation({
    mutationFn: async ({ id, adjustment, reason }) => {
      const res = await api.post(`/medicines/${id}/adjust-stock`, {
        adjustment: Number(adjustment),
        reason: reason.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard'] });
      setStatusMsg(`Stock for '${data.medicine_name}' updated to ${data.quantity} units.`);
      setAdjustModalMed(null);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Stock adjustment failed');
    },
  });

  const handleAdjustSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);
    const num = Number(adjustmentAmount);
    if (isNaN(num) || num === 0) {
      setErrorMsg('Please enter a non-zero adjustment amount (positive to add, negative to reduce).');
      return;
    }
    if (!adjustmentReason.trim()) {
      setErrorMsg('A specific reason is required for inventory audit compliance.');
      return;
    }

    adjustMutation.mutate({
      id: adjustModalMed.id,
      adjustment: num,
      reason: adjustmentReason,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-teal-600" />
            Inventory & Batch Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time batch tracking, stock level monitoring, and authorized manual stock adjustments with audit logging.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medicine or batch..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
          />
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-400 mt-2">Loading inventory ledger...</p>
          </div>
        ) : medicines.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No medicines found matching "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Medicine & Formulation</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Primary Batch</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {medicines.map((med) => {
                  const isLow = med.quantity <= 15;
                  const isOut = med.quantity <= 0;

                  return (
                    <tr key={med.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{med.medicine_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {med.strength || ''} {med.dosage_form ? `• ${med.dosage_form}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">{med.category || 'General'}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {med.batch_number || 'FEFO Active'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {med.expiry_date ? new Date(med.expiry_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">₹{med.selling_price}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {med.quantity} Units
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setAdjustModalMed(med)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Stock Adjustment Modal */}
      {adjustModalMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Adjust Stock: {adjustModalMed.medicine_name}
              </h3>
              <button onClick={() => setAdjustModalMed(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <span>Current Stock on Record:</span>
              <span className="font-bold text-slate-900 text-sm">{adjustModalMed.quantity} Units</span>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Stock Adjustment (Units) *
                </label>
                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="e.g. +10 (Add stock) or -5 (Damage/Breakage)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900 font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Resulting Stock:{' '}
                  <strong>
                    {Math.max(0, adjustModalMed.quantity + (Number(adjustmentAmount) || 0))} Units
                  </strong>
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Reason for Adjustment (Audit Mandatory) *
                </label>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g. Broken vial during handling, manufacturer sample addition, physical count variance..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalMed(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition"
                >
                  {adjustMutation.isPending ? 'Updating...' : 'Confirm Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
