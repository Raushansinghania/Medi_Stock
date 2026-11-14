import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Receipt,
  Search,
  Printer,
  Download,
  Eye,
  X,
  FileText,
  Building,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function CustomerInvoicesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Fetch customer invoices (backend automatically isolates to logged in customer)
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['customer-invoices', searchTerm],
    queryFn: async () => {
      const param = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const res = await api.get(`/sales${param}`);
      return res.data || [];
    },
  });

  // Fetch full invoice detail when modal opened
  const { data: invoiceDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['customer-invoice-detail', selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice) return null;
      const res = await api.get(`/sales/${selectedInvoice.id}`);
      return res.data;
    },
    enabled: !!selectedInvoice,
  });

  const invoices = invoicesData || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Invoices & Receipts</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official tax invoices and digital purchase receipts for your records
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by invoice number (e.g. INV-2026-...)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800"
          />
        </div>
        <span className="text-xs font-semibold text-slate-400">
          {invoices.length} Registered Invoices
        </span>
      </div>

      {/* Invoices List */}
      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Retrieving verified invoices from MySQL..." />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No invoices generated yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Once your pharmacy purchases and delivered orders are finalized, digital tax invoices will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">{inv.invoice_number}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                      Tax Invoice
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Issue Date: {new Date(inv.sale_date).toLocaleDateString()} • Payment:{' '}
                    <span className="uppercase font-semibold text-slate-600">{inv.payment_method}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5">
                <div className="sm:text-right">
                  <span className="text-base font-black text-slate-900 block">
                    ${Number(inv.total_amount).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    ✓ Paid in Full
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedInvoice(inv)}
                  className="px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-4 h-4" /> View Invoice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-150"
            id="printable-invoice"
          >
            {/* Modal Top Actions */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Official Electronic Tax Invoice
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Printer className="w-4 h-4" /> Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Pharmacy Branding & Header */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-sm">
                    M+
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">MediStock Pharmacy ERP</h2>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  License: PH-88921-2026 • 100 Health Science Blvd
                </p>
                <p className="text-[11px] text-slate-400">GST / Tax ID: MEDI-TAX-89210-USA</p>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 block">INVOICE NO</span>
                <span className="text-base font-black text-slate-900">
                  {selectedInvoice.invoice_number}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Date: {new Date(selectedInvoice.sale_date).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Bill To Customer Information */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-400 block uppercase tracking-wider text-[10px]">
                  Billed Patient
                </span>
                <p className="font-bold text-slate-800 mt-0.5">{selectedInvoice.customer_name || 'Michael Clark'}</p>
                <p className="text-slate-500">{selectedInvoice.customer_phone || '+1-555-0211'}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-400 block uppercase tracking-wider text-[10px]">
                  Payment Summary
                </span>
                <p className="font-semibold text-slate-800 uppercase mt-0.5">
                  {selectedInvoice.payment_method}
                </p>
                <p className="text-emerald-600 font-bold">Status: Paid in Full</p>
              </div>
            </div>

            {/* Itemized Table */}
            {isDetailLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading line items...</div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Item Description</th>
                      <th className="py-2.5 px-4 text-center">Batch</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Unit Price</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceDetail?.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {item.medicine_name}
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                          {item.batch_number || 'BATCH-STD'}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600">
                          ${Number(item.unit_price).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                          ${Number(item.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Financial Summary */}
            <div className="flex justify-end text-xs">
              <div className="w-64 space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(selectedInvoice.subtotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sales Tax (5%):</span>
                  <span className="font-semibold text-slate-900">
                    ${Number(selectedInvoice.tax).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Discounts Applied:</span>
                  <span className="font-semibold">-${Number(selectedInvoice.discount || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Amount Paid:</span>
                  <span className="text-teal-700">
                    ${Number(selectedInvoice.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Thermal / Pharmacy Footer Note */}
            <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 text-center leading-relaxed">
              Thank you for trusting MediStock Pharmacy! Medicines should be kept in a cool, dry place. For pharmaceutical assistance or medication questions, consult your licensed pharmacist.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
