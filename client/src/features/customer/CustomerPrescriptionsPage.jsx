import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Eye,
  Pill,
  ShieldCheck,
  Calendar,
  UserCheck,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerPrescriptionsPage() {
  // Fetch prescriptions (backend automatically isolates to logged in customer)
  const { data: prescriptionsData, isLoading } = useQuery({
    queryKey: ['customer-prescriptions'],
    queryFn: async () => {
      const res = await api.get('/prescriptions');
      return res.data || [];
    },
  });

  const prescriptions = prescriptionsData || [];

  const handleViewDocument = async (id, originalName) => {
    try {
      const token = localStorage.getItem('medistock_token');
      const response = await fetch(`/api/v1/prescriptions/${id}/file`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Unable to retrieve file from secure server storage');
      }

      const blob = await response.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      window.open(fileUrl, '_blank');
    } catch (err) {
      alert(err.message || 'Failed to open document');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Prescriptions</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track validation status of doctor prescriptions and access verified dispensing records
          </p>
        </div>
        <Link
          to="/customer/prescriptions/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
        >
          <UploadCloud className="w-4 h-4" /> Upload New Prescription
        </Link>
      </div>

      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Retrieving verified prescription files..." />
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-2xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Prescriptions On File</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            You haven't uploaded any prescriptions yet. Upload your doctor's note for quick clinical verification.
          </p>
          <Link
            to="/customer/prescriptions/upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            <UploadCloud className="w-4 h-4" /> Upload First Prescription
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {prescriptions.map((rx) => {
            const isApproved = rx.status === 'approved';
            const isRejected = rx.status === 'rejected';
            const isPending = rx.status === 'pending';

            return (
              <div
                key={rx.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4 hover:border-teal-200 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Status & Date */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-bold uppercase border flex items-center gap-1.5',
                        getStatusBadge(rx.status)
                      )}
                    >
                      {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isRejected && <AlertCircle className="w-3.5 h-3.5" />}
                      {isPending && <Clock className="w-3.5 h-3.5" />}
                      {rx.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ID: #RX-{String(rx.id).padStart(4, '0')}
                    </span>
                  </div>

                  {/* Doctor Info */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {rx.doctor_name || 'Attending Clinical Physician'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Prescribed:{' '}
                      {rx.prescription_date
                        ? new Date(rx.prescription_date).toLocaleDateString()
                        : 'Recent'}
                    </p>
                  </div>

                  {/* Customer Notes */}
                  {rx.notes && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                      <span className="font-semibold text-slate-400 text-[10px] uppercase block mb-0.5">
                        Patient Instructions:
                      </span>
                      {rx.notes}
                    </div>
                  )}

                  {/* Pharmacist Rejection Feedback Box */}
                  {isRejected && (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-red-800">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        Pharmacist Rejection Feedback
                      </div>
                      <p className="text-[11px] text-red-700 leading-relaxed">
                        {rx.rejection_reason ||
                          'Prescription image is illegible or date has expired. Please re-upload a clear photograph of your original prescription.'}
                      </p>
                    </div>
                  )}

                  {/* Approved Info */}
                  {isApproved && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-[11px]">
                        Approved for dispensing. Valid for prescription-only medicine orders.
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  {rx.file_path || rx.prescription_image ? (
                    <button
                      type="button"
                      onClick={() => handleViewDocument(rx.id, rx.original_filename)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Uploaded File
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">Electronic submission</span>
                  )}

                  {isApproved && (
                    <Link
                      to="/customer/medicines"
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs"
                    >
                      <Pill className="w-3.5 h-3.5" /> Order Medicines
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
