import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Receipt,
  FileCheck2,
  Calendar,
  X,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistCustomersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewCustomerId, setViewCustomerId] = useState(null);
  const [activeTab, setActiveTab] = useState('prescriptions');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch Customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['pharmacist-customers', searchTerm],
    queryFn: async () => {
      const res = await api.get(`/customers?search=${encodeURIComponent(searchTerm)}`);
      return res.data;
    },
  });

  // Fetch specific customer details
  const { data: customerDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['customer-details', viewCustomerId],
    queryFn: async () => {
      if (!viewCustomerId) return null;
      const res = await api.get(`/customers/${viewCustomerId}`);
      return res.data;
    },
    enabled: !!viewCustomerId,
  });

  // Create Customer Mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/customers', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacist-customers'] });
      setStatusMsg(`Customer '${data.customer_name}' added successfully.`);
      setIsAddModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setTimeout(() => setStatusMsg(null), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Failed to register customer');
    },
  });

  const handleCreateCustomer = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Customer name is required');
      return;
    }
    createMutation.mutate({
      customer_name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            Patient & Customer Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Register walk-in patients, review dispensing history, verify contact information, and initiate POS billing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Walk-in Customer
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer by name, phone, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
          />
        </div>
        <span className="text-xs text-slate-500 hidden sm:block">
          Total Registered: <strong className="text-slate-800">{customers.length}</strong>
        </span>
      </div>

      {/* Customer Grid */}
      {isLoading ? (
        <div className="p-12 text-center">
          <LoadingSpinner />
          <p className="text-xs text-slate-400 mt-2">Loading directory...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="font-semibold text-slate-700 text-sm">No customers found</p>
          <p className="text-xs text-slate-400 mt-1">Add a new walk-in patient or refine your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-sm">
                    {c.customer_name ? c.customer_name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{c.customer_name}</h3>
                    <p className="text-[11px] text-slate-400">Patient ID: #{c.id}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Completed Bills: <strong>{c.total_orders || 0}</strong></span>
                  <span>Total Purchases: <strong className="text-teal-700">${Number(c.total_spent || 0).toFixed(2)}</strong></span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewCustomerId(c.id);
                    setActiveTab('prescriptions');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition inline-flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  History
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/pharmacist/pos')}
                  className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 text-xs font-semibold border border-teal-200 transition inline-flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Bill at POS
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Details & History Modal */}
      {viewCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  {customerDetails?.customer_name || 'Patient Details'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patient ID #{viewCustomerId} • Registered: {customerDetails?.created_at?.slice(0, 10) || '—'}
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
                <LoadingSpinner text="Fetching full clinical history..." />
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
                    onClick={() => setActiveTab('prescriptions')}
                    className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'prescriptions'
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Prescriptions ({customerDetails.prescriptions?.length || 0})
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
                    onClick={() => setActiveTab('sales')}
                    className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'sales'
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    POS Sales ({customerDetails.sales?.length || 0})
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'prescriptions' && (
                  <div className="space-y-2">
                    {customerDetails.prescriptions?.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">No prescriptions found for this patient.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Rx ID</th>
                              <th className="py-2.5 px-3">Doctor</th>
                              <th className="py-2.5 px-3">Diagnosis / Remarks</th>
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

      {/* Add Walk-in Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Register Walk-in Customer</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Meera Sharma"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mobile / WhatsApp Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1-555-0199"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Address / Landmark</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Apartment, Street, City"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition"
                >
                  {createMutation.isPending ? 'Saving...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
