import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  X,
  Download,
  Calendar,
  UserCheck,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PrescriptionOversightPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);

  const { data: oversightData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-prescriptions-overview'],
    queryFn: async () => {
      const res = await api.get('/admin/prescriptions/overview');
      return res.data;
    },
    refetchInterval: 25000,
  });

  const metrics = oversightData?.metrics || {};
  const recentReviews = oversightData?.recentReviews || [];

  const filteredReviews = recentReviews.filter((r) => {
    const matchesSearch =
      !search ||
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.doctor_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toString().includes(search);
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-2">
            <FileText className="w-3.5 h-3.5" /> Clinical Dispensing Governance
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prescription Oversight</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit pharmacist review decisions, monitor compliance timelines, and investigate dispensing records.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* Clinical Boundary Notice */}
      <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex items-start gap-3 text-xs text-teal-900 leading-relaxed">
        <ShieldAlert className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Regulatory & Clinical Policy:</span> Clinical prescription approvals, drug interaction checks, and dispensing authorizations are strictly reserved for licensed pharmacists in the Pharmacist Panel. Administrators possess full auditing, investigative, and oversight visibility.
        </div>
      </div>

      {/* Pipeline Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
          <span className="text-[11px] font-semibold text-slate-500">Total Uploaded</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.total_prescriptions || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm text-center">
          <span className="text-[11px] font-semibold text-amber-700">Pending Review</span>
          <p className="text-2xl font-bold text-amber-800 mt-1">{metrics.pending_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm text-center">
          <span className="text-[11px] font-semibold text-blue-700">Under Review</span>
          <p className="text-2xl font-bold text-blue-800 mt-1">{metrics.under_review_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-teal-200 bg-teal-50/30 shadow-sm text-center">
          <span className="text-[11px] font-semibold text-teal-700">Approved</span>
          <p className="text-2xl font-bold text-teal-800 mt-1">{metrics.approved_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm text-center">
          <span className="text-[11px] font-semibold text-emerald-700">Dispensed</span>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{metrics.dispensed_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/30 shadow-sm text-center">
          <span className="text-[11px] font-semibold text-red-700">Rejected</span>
          <p className="text-2xl font-bold text-red-800 mt-1">{metrics.rejected_count || 0}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name, prescribing doctor, or prescription ID..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
          >
            <option value="">All Verification Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="dispensed">Dispensed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Prescriptions Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" message="Loading prescription verification audit trail..." />
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No prescription records match filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="py-3 px-4">Rx ID</th>
                  <th className="py-3 px-4">Patient Information</th>
                  <th className="py-3 px-4">Prescribing Doctor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reviewing Pharmacist</th>
                  <th className="py-3 px-4">Verification Notes</th>
                  <th className="py-3 px-4 text-right">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReviews.map((rx) => (
                  <tr key={rx.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-slate-800">
                      #{rx.id}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 leading-tight">{rx.customer_name || 'Walk-in Patient'}</p>
                      <p className="text-xs text-slate-500">{rx.customer_phone || rx.customer_email || 'No contact provided'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {rx.doctor_name || 'Not Specified'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          rx.status === 'approved'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : rx.status === 'dispensed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rx.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : rx.status === 'under_review'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {rx.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {rx.reviewer_name ? (
                        <span className="font-medium flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600" /> {rx.reviewer_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unreviewed</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate" title={rx.verification_remarks || rx.rejection_reason}>
                      {rx.rejection_reason ? (
                        <span className="text-red-600 font-medium">Rejection Reason: {rx.rejection_reason}</span>
                      ) : rx.verification_remarks ? (
                        rx.verification_remarks
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {rx.image_url ? (
                        <button
                          onClick={() => setSelectedDoc(rx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No File</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Document Viewer */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Prescription Document #{selectedDoc.id}
                </h2>
                <p className="text-xs text-slate-500">
                  Patient: {selectedDoc.customer_name} • Doctor: {selectedDoc.doctor_name || 'N/A'}
                </p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-auto flex items-center justify-center bg-slate-100 rounded-xl p-4 min-h-[300px]">
              {selectedDoc.image_url?.endsWith('.pdf') ? (
                <div className="text-center">
                  <FileText className="w-16 h-16 text-red-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-800">PDF Medical Document</p>
                  <a
                    href={selectedDoc.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" /> Open Full Document
                  </a>
                </div>
              ) : (
                <img
                  src={selectedDoc.image_url}
                  alt="Prescription"
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-sm"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://placehold.co/600x800?text=Prescription+Document';
                  }}
                />
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
              <span>Status: <strong className="text-slate-800">{selectedDoc.status.toUpperCase()}</strong></span>
              <button
                onClick={() => setSelectedDoc(null)}
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
