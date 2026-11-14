import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  AlertCircle,
  X,
  ShoppingBag,
  Eye,
  FileText,
  Calendar,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewCustomerId, setViewCustomerId] = useState(null);
  const [activeTab, setActiveTab] = useState('sales');
  const [statusMsg, setStatusMsg] = useState(null);
  const [newCustomer, setNewCustomer] = useState({
    customer_name: '',
    phone: '',
    email: '',
    address: '',
  });

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: async () => {
      const res = await api.get(`/customers?search=${encodeURIComponent(searchTerm)}`);
      return res.data;
    },
  });

  const { data: customerDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['customer-details', viewCustomerId],
    queryFn: async () => {
      if (!viewCustomerId) return null;
      const res = await api.get(`/customers/${viewCustomerId}`);
      return res.data;
    },
    enabled: !!viewCustomerId,
  });

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/customers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      setNewCustomer({ customer_name: '', phone: '', email: '', address: '' });
      setStatusMsg({ type: 'success', text: 'Customer registered successfully in MySQL!' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to register customer' });
      setTimeout(() => setStatusMsg(null), 4000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    addMutation.mutate(newCustomer);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Registered patients, loyalty billing, and clinical order histories
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers by name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
          />
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200"
        >
          Refresh
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="lg" text="Loading customers from MySQL..." />
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No customers registered yet</h3>
            <p className="text-xs text-slate-500 mt-1">Register a customer to link repeat sales and prescriptions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Address</th>
                  <th className="py-3.5 px-4 text-center">Orders</th>
                  <th className="py-3.5 px-4 text-right">Total Spent</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.customer_name}</td>
                    <td className="py-3 px-4 text-slate-600">{c.phone || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">{c.email || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{c.address || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {c.total_orders || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-teal-700">
                      ${Number(c.total_spent || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{c.created_at?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setViewCustomerId(c.id);
                          setActiveTab('sales');
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Profile & History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Details & History Modal */}
      {viewCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  {customerDetails?.customer_name || 'Customer Details'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID #{viewCustomerId} • Registered: {customerDetails?.created_at?.slice(0, 10) || '—'}
                </p>
              </div>
              <button
                onClick={() => setViewCustomerId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="py-12 text-center">
                <LoadingSpinner text="Fetching full history from database..." />
              </div>
            ) : customerDetails ? (
              <div className="space-y-5">
                {/* Contact Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Phone</span>
                    <span className="text-slate-800 font-semibold">{customerDetails.phone || 'Not recorded'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Email</span>
                    <span className="text-slate-800 font-semibold">{customerDetails.email || 'Not recorded'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Address</span>
                    <span className="text-slate-800 font-semibold">{customerDetails.address || 'Not recorded'}</span>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('sales')}
                    className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'sales'
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Sales Invoices ({customerDetails.sales?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'orders'
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Online Orders ({customerDetails.orders?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('prescriptions')}
                    className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'prescriptions'
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Prescriptions ({customerDetails.prescriptions?.length || 0})
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'sales' && (
                  <div className="space-y-2">
                    {customerDetails.sales?.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">No sales invoices found for this customer.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Invoice #</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Payment</th>
                              <th className="py-2.5 px-3 text-right">Total Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerDetails.sales?.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-semibold text-slate-900">{s.invoice_number}</td>
                                <td className="py-2 px-3 text-slate-500">{s.sale_date?.slice(0, 10) || s.created_at?.slice(0, 10)}</td>
                                <td className="py-2 px-3">
                                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {s.payment_method || 'CASH'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-teal-700">
                                  ${Number(s.total_amount || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-2">
                    {customerDetails.orders?.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">No online orders found for this customer.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Order #</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerDetails.orders?.map((o) => (
                              <tr key={o.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-semibold text-slate-900">{o.order_number}</td>
                                <td className="py-2 px-3 text-slate-500">{o.created_at?.slice(0, 10)}</td>
                                <td className="py-2 px-3">
                                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {o.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-teal-700">
                                  ${Number(o.total_amount || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'prescriptions' && (
                  <div className="space-y-2">
                    {customerDetails.prescriptions?.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">No prescriptions found for this customer.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Rx ID</th>
                              <th className="py-2.5 px-3">Doctor</th>
                              <th className="py-2.5 px-3">Diagnosis / Notes</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerDetails.prescriptions?.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-semibold text-slate-900">RX-{p.id}</td>
                                <td className="py-2 px-3 text-slate-600">{p.doctor_name || 'Self-Uploaded'}</td>
                                <td className="py-2 px-3 text-slate-500 max-w-xs truncate">{p.diagnosis || p.notes || '—'}</td>
                                <td className="py-2 px-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    p.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                    p.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                                    p.status === 'dispensed' ? 'bg-teal-50 text-teal-700' :
                                    'bg-amber-50 text-amber-700'
                                  }`}>
                                    {p.status?.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-400">{p.created_at?.slice(0, 10)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewCustomerId(null)}
                className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Customer</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Watson"
                  value={newCustomer.customer_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+1-555-0199"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="jane@example.com"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows="2"
                  placeholder="Residential address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-4 py-2 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow disabled:opacity-50"
                >
                  {addMutation.isPending ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
