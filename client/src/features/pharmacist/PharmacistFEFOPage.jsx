import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Layers,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ClockAlert,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistFEFOPage() {
  const [selectedMedicineId, setSelectedMedicineId] = useState('1'); // Default to Paracetamol
  const [requestedQty, setRequestedQty] = useState(70); // Default to prompt's 70 units example

  // Fetch all medicines for dropdown
  const { data: medicines = [] } = useQuery({
    queryKey: ['fefo-medicines-dropdown'],
    queryFn: async () => {
      const res = await api.get('/medicines?limit=100');
      return res.data;
    },
  });

  // Calculate FEFO allocation via backend calculation engine
  const { data: fefoResult, isLoading, isError } = useQuery({
    queryKey: ['fefo-calculation', selectedMedicineId, requestedQty],
    queryFn: async () => {
      if (!selectedMedicineId || requestedQty <= 0) return null;
      const res = await api.get(
        `/pharmacist/fefo/calculate?medicine_id=${selectedMedicineId}&quantity=${requestedQty}`
      );
      return res.data;
    },
    enabled: !!selectedMedicineId && requestedQty > 0,
  });

  // Also fetch all batches for this medicine (including blocked/expired)
  const { data: allBatches = [] } = useQuery({
    queryKey: ['all-batches-for-med', selectedMedicineId],
    queryFn: async () => {
      if (!selectedMedicineId) return [];
      const res = await api.get('/pharmacist/expiry-monitoring');
      const all = [
        ...(res.data?.expired || []),
        ...(res.data?.within30Days || []),
        ...(res.data?.within60Days || []),
        ...(res.data?.within90Days || []),
        ...(res.data?.safeStock || []),
      ];
      return all.filter((b) => b.medicine_id === Number(selectedMedicineId));
    },
    enabled: !!selectedMedicineId,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Layers className="w-6 h-6 text-teal-600" />
          FEFO (First Expiry, First Out) Dispensing Engine
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Automated batch-level sequential allocation algorithm ensuring stock with the closest expiration date is dispensed first while blocking expired units.
        </p>
      </div>

      {/* FEFO Concept Explanation Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-900 to-slate-900 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-400 text-slate-950 uppercase">
              Clinical Standard
            </span>
            <h3 className="text-sm font-bold text-white">How FEFO Works at MediStock</h3>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            When dispensing medications, MediStock automatically calculates and exhausts batches with the earliest expiry date first. Expired batches are blocked, and subsequent batches are preserved atomically.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-white/10 px-3.5 py-2 rounded-xl border border-white/20 flex-shrink-0">
          <ClockAlert className="w-4 h-4 text-teal-300" />
          <span>Earliest Expiry $\rightarrow$ Next Expiry $\rightarrow$ Preserved</span>
        </div>
      </div>

      {/* Interactive FEFO Allocation Simulator Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-600" />
          Live FEFO Allocation Simulator & Verification
        </h2>

        {/* Form Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Select Medicine Master *</label>
            <select
              value={selectedMedicineId}
              onChange={(e) => setSelectedMedicineId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900"
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.medicine_name} ({m.quantity} in total stock)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Dispensing Quantity (Requested Units) *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={requestedQty}
                onChange={(e) => setRequestedQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <div className="flex items-center gap-1">
                {[50, 70, 100, 150].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRequestedQty(preset)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live FEFO Allocation Breakdown */}
        {isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-400 mt-2">Computing optimal FEFO batch sequence...</p>
          </div>
        ) : fefoResult ? (
          <div className="space-y-4">
            {/* Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span className="font-bold text-teal-950">
                  Allocation for: {fefoResult.medicine?.medicine_name}
                </span>
              </div>
              <div className="flex items-center gap-4 text-slate-700">
                <span>Requested: <strong>{fefoResult.requested_quantity}</strong></span>
                <span>Allocated: <strong className="text-teal-700">{fefoResult.total_allocated}</strong></span>
                <span>
                  Status:{' '}
                  <strong className={fefoResult.is_fully_allocated ? 'text-emerald-700' : 'text-amber-700'}>
                    {fefoResult.is_fully_allocated ? 'Fully Satisfied' : 'Partial (Stock Depleted)'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Batch Allocation Waterfall Cards */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                FEFO Sequence Allocation Waterfall
              </span>

              {fefoResult.allocations.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                  No unexpired or eligible batches available for dispensing.
                </div>
              ) : (
                fefoResult.allocations.map((alloc, idx) => (
                  <div
                    key={alloc.batch_id}
                    className="p-4 rounded-xl border border-teal-300 bg-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs flex-shrink-0 shadow-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900">{alloc.batch_number}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                            Expires in {alloc.days_until_expiry} days
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Expiry: {new Date(alloc.expiry_date).toLocaleDateString()} • Available in Batch:{' '}
                          {alloc.available_in_batch} Units
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto text-xs">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispensed</span>
                        <span className="text-base font-black text-teal-700">
                          {alloc.allocated_qty} Units
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining in Batch</span>
                        <span className="text-xs font-bold text-slate-600">
                          {alloc.remaining_in_batch_after} Units
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* All Batches on Record for Selected Medicine (Including Expired & Quarantined) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Boxes className="w-4 h-4 text-slate-600" />
          All Batches on Record for Selected Medicine
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Batch Number</th>
                <th className="py-2.5 px-3">Quantity</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3">Days Until Expiry</th>
                <th className="py-2.5 px-3">FEFO Status</th>
                <th className="py-2.5 px-3 text-right">Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {allBatches.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-400 font-sans">
                    No batches found for this medicine.
                  </td>
                </tr>
              ) : (
                allBatches.map((b) => {
                  const isExpired = b.days_left < 0;
                  const isBlocked = b.is_blocked;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition font-sans">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{b.batch_number}</td>
                      <td className="py-2.5 px-3 font-bold">{b.quantity} Units</td>
                      <td className="py-2.5 px-3">
                        {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {isExpired ? (
                          <span className="text-red-600">Expired {Math.abs(b.days_left)}d ago</span>
                        ) : (
                          <span className="text-slate-800">{b.days_left} days</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {isExpired || isBlocked ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            BLOCKED FROM SALE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ACTIVE FOR FEFO
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isBlocked ? (
                          <span className="text-[10px] text-rose-600 font-semibold">{b.blocked_reason || 'Quarantined'}</span>
                        ) : isExpired ? (
                          <span className="text-[10px] text-rose-600 font-semibold">Expired stock blocked</span>
                        ) : (
                          <span className="text-[10px] text-teal-700 font-semibold">Eligible for dispensing</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
