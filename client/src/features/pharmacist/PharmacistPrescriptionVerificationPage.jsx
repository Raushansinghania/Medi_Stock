import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Calendar,
  X,
  FileText,
  ShieldCheck,
  Check,
  RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistPrescriptionVerificationPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModalRx, setActiveModalRx] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject' | 'under_review' | 'dispense'
  const [rejectionReason, setRejectionReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch prescriptions
  const { data: prescriptions = [], isLoading, refetch } = useQuery({
    queryKey: ['pharmacist-prescriptions', selectedStatus],
    queryFn: async () => {
      const url = selectedStatus
        ? `/prescriptions?status=${selectedStatus}`
        : '/prescriptions';
      const res = await api.get(url);
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Status Update Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.patch(`/prescriptions/${id}/status`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['pharmacist-dashboard-badges'] });
      setSuccessMsg(`Prescription #${data.id} successfully marked as ${data.status.toUpperCase()}.`);
      closeModal();
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to update prescription status.');
    },
  });

  const closeModal = () => {
    setActiveModalRx(null);
    setActionType(null);
    setRejectionReason('');
    setRemarks('');
    setErrorMsg(null);
  };

  const handleActionSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!activeModalRx) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      setErrorMsg('Please specify a clinical or administrative reason for rejecting this prescription.');
      return;
    }

    const payload = {
      status:
        actionType === 'approve'
          ? 'approved'
          : actionType === 'reject'
          ? 'rejected'
          : actionType === 'under_review'
          ? 'under_review'
          : 'dispensed',
      rejection_reason: actionType === 'reject' ? rejectionReason.trim() : null,
      verification_remarks: remarks.trim() || undefined,
    };

    updateStatusMutation.mutate({ id: activeModalRx.id, payload });
  };

  const filteredPrescriptions = prescriptions.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (p.customer_name || '').toLowerCase().includes(q) ||
      (p.doctor_name || '').toLowerCase().includes(q) ||
      (p.id || '').toString().includes(q) ||
      (p.original_filename || '').toLowerCase().includes(q)
    );
  });

  const statusBadges = {
    pending: { label: 'Pending Review', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-800 border-rose-200' },
    dispensed: { label: 'Dispensed', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-teal-600" />
            Prescription Verification Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review uploaded patient prescriptions, perform clinical checks, approve eligible orders, or record rejection reasons.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Queue
        </button>
      </div>

      {/* Notifications Banner */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: 'All Prescriptions', value: '' },
            { label: 'Pending Review', value: 'pending' },
            { label: 'Under Review', value: 'under_review' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'Dispensed', value: 'dispensed' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedStatus === tab.value
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search patient, doctor, ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
          />
        </div>
      </div>

      {/* Prescriptions List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-500 mt-2">Loading verification queue...</p>
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-slate-700">No prescriptions match your filter</p>
            <p className="text-xs text-slate-400 mt-1">Pending prescription uploads will automatically appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Rx ID</th>
                  <th className="py-3 px-4">Patient / Customer</th>
                  <th className="py-3 px-4">Prescriber / Doctor</th>
                  <th className="py-3 px-4">Rx Date</th>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPrescriptions.map((rx) => {
                  const badge = statusBadges[rx.status] || {
                    label: rx.status,
                    color: 'bg-slate-100 text-slate-700',
                  };

                  return (
                    <tr key={rx.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">#{rx.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{rx.customer_name || 'Customer'}</div>
                        {rx.customer_phone && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {rx.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800">{rx.doctor_name || 'Not Specified'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {rx.prescription_date ? new Date(rx.prescription_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono border border-slate-200 max-w-[130px] truncate">
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{rx.original_filename || 'prescription'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {rx.rejection_reason && (
                          <p className="text-[10px] text-red-600 font-medium mt-0.5 max-w-[150px] truncate" title={rx.rejection_reason}>
                            Reason: {rx.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setActiveModalRx(rx)}
                          className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold border border-teal-200 transition"
                        >
                          Review & Verify
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

      {/* Prescription Inspection & Verification Modal */}
      {activeModalRx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Prescription #{activeModalRx.id} – Clinical Review
                </h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Patient and Prescriber Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Patient</span>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5">
                    {activeModalRx.customer_name || 'Registered Customer'}
                  </p>
                  <p className="text-slate-500">{activeModalRx.customer_phone || 'No phone'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Prescribing Physician</span>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5">
                    {activeModalRx.doctor_name || 'Unspecified'}
                  </p>
                  <p className="text-slate-500">
                    Rx Date:{' '}
                    {activeModalRx.prescription_date
                      ? new Date(activeModalRx.prescription_date).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Status</span>
                  <div className="mt-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        statusBadges[activeModalRx.status]?.color || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {statusBadges[activeModalRx.status]?.label || activeModalRx.status}
                    </span>
                  </div>
                  {activeModalRx.verified_by_name && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Verified by: {activeModalRx.verified_by_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Patient Notes */}
              {activeModalRx.notes && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-xs">
                  <span className="font-bold text-amber-800">Patient Notes: </span>
                  <span className="text-slate-700">{activeModalRx.notes}</span>
                </div>
              )}

              {/* Prescription Document Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-teal-600" /> Uploaded Document
                  </span>
                  <a
                    href={`/api/v1/prescriptions/${activeModalRx.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    <Download className="w-3.5 h-3.5" /> Download / Open Raw
                  </a>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 min-h-[220px] flex items-center justify-center overflow-hidden">
                  {activeModalRx.file_type === 'application/pdf' ? (
                    <div className="text-center py-6">
                      <FileText className="w-12 h-12 text-teal-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-800">PDF Medical Document</p>
                      <p className="text-[11px] text-slate-500 mb-3">{activeModalRx.original_filename}</p>
                      <a
                        href={`/api/v1/prescriptions/${activeModalRx.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View PDF in Tab
                      </a>
                    </div>
                  ) : (
                    <img
                      src={`/api/v1/prescriptions/${activeModalRx.id}/file`}
                      alt="Prescription Document"
                      className="max-h-[380px] w-auto object-contain rounded-lg shadow-sm"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.innerHTML = `
                          <div class="text-center p-6 text-slate-400 text-xs">
                            <p class="font-medium">Uploaded file: ${activeModalRx.original_filename || 'prescription.png'}</p>
                            <a href="/api/v1/prescriptions/${activeModalRx.id}/file" target="_blank" class="text-teal-600 font-semibold underline mt-2 block">
                              Click to download / inspect
                            </a>
                          </div>
                        `;
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Clinical Verification Checklist */}
              <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200/80 text-xs text-slate-700 space-y-1.5">
                <p className="font-bold text-teal-900 uppercase text-[10px] tracking-wider">
                  Mandatory Dispensing & Verification Checklist
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600" /> Patient identity & contact matched
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600" /> Prescriber signature & reg. valid
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600" /> Medicine name & strengths verified
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600" /> No adverse drug-drug interactions
                  </div>
                </div>
              </div>

              {/* Action Decision Form */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800">Verification Decision:</span>

                {/* Decision Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType('approve')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      actionType === 'approve'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    ✓ Approve Rx
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('under_review')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      actionType === 'under_review'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    ⏳ Under Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('dispense')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      actionType === 'dispense'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                    }`}
                  >
                    💊 Dispensed
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('reject')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      actionType === 'reject'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    ✕ Reject Rx
                  </button>
                </div>

                {/* Conditional Rejection Reason Input (Mandatory when rejecting) */}
                {actionType === 'reject' && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1.5">
                    <label className="text-[11px] font-bold text-rose-900 block">
                      Rejection Reason (Required – will be presented directly to patient):
                    </label>
                    <textarea
                      rows="2"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Unclear doctor signature, dosage missing, expired prescription validity, or scheduled drug restrictions..."
                      className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* Verification Remarks Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Pharmacist Clinical Remarks (Optional):</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Verified with Dr. Shaw clinic; patient advised 1 tab after meals."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    {errorMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/70">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!actionType || updateStatusMutation.isPending}
                onClick={handleActionSubmit}
                className={`px-5 py-2 rounded-xl text-white text-xs font-semibold transition shadow-sm ${
                  !actionType
                    ? 'bg-slate-300 cursor-not-allowed'
                    : actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionType === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : actionType === 'under_review'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Save Decision & Notify Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
