import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  FileText,
  Search,
  Calendar,
  Printer,
  Download,
  Eye,
  CheckCircle2,
  DollarSign,
  X,
  CreditCard,
  QrCode,
  Receipt,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistSalesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewInvoice, setViewInvoice] = useState(null);

  // Fetch sales list
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['pharmacist-sales', searchTerm, fromDate, toDate],
    queryFn: async () => {
      let url = `/sales?search=${encodeURIComponent(searchTerm)}`;
      if (fromDate) url += `&from_date=${fromDate}`;
      if (toDate) url += `&to_date=${toDate}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  // Fetch individual sale details when invoice is clicked
  const { data: invoiceDetails, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ['sale-details', viewInvoice?.id],
    queryFn: async () => {
      if (!viewInvoice?.id) return null;
      const res = await api.get(`/sales/${viewInvoice.id}`);
      return res.data;
    },
    enabled: !!viewInvoice?.id,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" />
          Sales & Tax Invoice Registry
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review completed pharmacy sales, inspect FEFO-dispensed line items, verify payments, and reprint GST tax invoices.
        </p>
      </div>

      {/* Search and Date Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice number or customer..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner />
            <p className="text-xs text-slate-400 mt-2">Loading sales ledger...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700">No sales recorded matching criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.invoice_number}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {s.sale_date ? new Date(s.sale_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{s.customer_name || 'Walk-in Cash Patient'}</div>
                      {s.customer_phone && (
                        <div className="text-[11px] text-slate-400">{s.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{s.total_items || 1}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {s.payment_method || 'Cash'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-sm text-slate-900">
                      ₹{Number(s.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setViewInvoice(s)}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold border border-teal-200 transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Tax Invoice Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-600" />
                Tax Invoice #{viewInvoice.invoice_number}
              </h3>
              <button onClick={() => setViewInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isInvoiceLoading ? (
              <div className="py-8 text-center">
                <LoadingSpinner />
              </div>
            ) : invoiceDetails ? (
              <div className="space-y-4">
                {/* Printable Invoice Container */}
                <div id="invoice-modal-print" className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-3">
                  <div className="text-center pb-3 border-b border-dashed border-slate-300">
                    <h2 className="text-base font-black text-slate-900">MEDISTOCK PHARMACY & ERP</h2>
                    <p className="text-[11px] text-slate-600">Licensed Retail Dispensary • Sector 4, Medical City</p>
                    <p className="text-[10px] text-slate-500">GSTIN: 27AABCM8291M1Z5 • D.L. No: 20B/21B-49204</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <p><strong>Invoice:</strong> {invoiceDetails.invoice_number}</p>
                      <p><strong>Date:</strong> {invoiceDetails.sale_date}</p>
                    </div>
                    <div className="text-right">
                      <p><strong>Patient:</strong> {invoiceDetails.customer_name || 'Walk-in Patient'}</p>
                      <p><strong>Contact:</strong> {invoiceDetails.phone || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Dispensed Items with Batch Numbers */}
                  <div className="py-2 border-y border-dashed border-slate-300">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-200 pb-1">
                          <th>Item</th>
                          <th>Batch</th>
                          <th className="text-center">Qty</th>
                          <th className="text-right">Rate</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {(invoiceDetails.items || []).map((it, idx) => (
                          <tr key={idx} className="py-1">
                            <td className="py-1 font-bold text-slate-900 truncate max-w-[130px]">
                              {it.medicine_name}
                            </td>
                            <td className="py-1 text-slate-600">{it.batch_number || 'FEFO'}</td>
                            <td className="py-1 text-center font-bold">{it.quantity}</td>
                            <td className="py-1 text-right">₹{it.unit_price}</td>
                            <td className="py-1 text-right font-bold">₹{it.subtotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 text-right text-[11px] text-slate-600">
                    <div>Subtotal: ₹{invoiceDetails.subtotal}</div>
                    {Number(invoiceDetails.discount) > 0 && (
                      <div className="text-emerald-700">Discount: -₹{invoiceDetails.discount}</div>
                    )}
                    <div>GST Tax: ₹{invoiceDetails.tax}</div>
                    <div className="text-base font-black text-slate-900 pt-1 border-t border-slate-300">
                      Final Total: ₹{invoiceDetails.total_amount}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">
                      Payment Status: Completed ({invoiceDetails.payment_method})
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Tax Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewInvoice(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
