import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
  Pill,
  Search,
  Filter,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck2,
  Boxes,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PharmacistCataloguePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  // Fetch medicines
  const { data: medicines = [], isLoading } = useQuery({
    queryKey: ['pharmacist-catalogue', searchTerm, categoryFilter],
    queryFn: async () => {
      let url = `/medicines?search=${encodeURIComponent(searchTerm)}`;
      if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
      const res = await api.get(url);
      return res.data;
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data;
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Pill className="w-6 h-6 text-teal-600" />
          Pharmacist Medicine Catalogue
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Clinical medicine master, formulations, strength specifications, current batch allocations, and prescription classifications.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, composition, brand, strength..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
          >
            <option value="">All Clinical Categories</option>
            {categories.map((cat) => (
              <option key={cat.id || cat.category_name} value={cat.category_name}>
                {cat.category_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalogue Grid */}
      {isLoading ? (
        <div className="p-12 text-center">
          <LoadingSpinner />
          <p className="text-xs text-slate-400 mt-2">Loading medicine directory...</p>
        </div>
      ) : medicines.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
          <Pill className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-slate-700">No medicines found</p>
          <p className="text-xs text-slate-400 mt-1">Try refining your search or category filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medicines.map((med) => {
            const isLowStock = med.quantity <= 15;
            const isOutOfStock = med.quantity <= 0;

            return (
              <div
                key={med.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{med.medicine_name}</h3>
                      <p className="text-[11px] text-slate-400">
                        {med.manufacturer || 'Licensed Manufacturer'}
                      </p>
                    </div>
                    {med.is_prescription_required ? (
                      <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-black border border-red-200 flex-shrink-0">
                        Rx Required
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex-shrink-0">
                        OTC General
                      </span>
                    )}
                  </div>

                  {/* Composition / Strength */}
                  <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] space-y-1">
                    {med.composition && (
                      <p className="text-slate-600 truncate">
                        <span className="font-semibold text-slate-700">Composition: </span>
                        {med.composition}
                      </p>
                    )}
                    <div className="flex justify-between text-slate-500">
                      <span>Category: <strong className="text-slate-700">{med.category || 'General'}</strong></span>
                      <span>Form: <strong className="text-slate-700">{med.dosage_form || 'Tablet'}</strong></span>
                    </div>
                    {med.strength && (
                      <p className="text-slate-500">
                        Strength: <strong className="text-slate-700">{med.strength}</strong>
                      </p>
                    )}
                  </div>

                  {/* Batch & Expiry Info */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500">
                      Primary Batch: <span className="font-bold text-slate-800">{med.batch_number || 'FEFO'}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {med.expiry_date ? new Date(med.expiry_date).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                </div>

                {/* Footer Pricing & Stock */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-black text-slate-900">₹{med.selling_price}</span>
                    {med.mrp && Number(med.mrp) > Number(med.selling_price) && (
                      <span className="text-xs text-slate-400 line-through ml-1.5">MRP ₹{med.mrp}</span>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      isOutOfStock
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : isLowStock
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {isOutOfStock ? 'Out of Stock' : `${med.quantity} in Stock`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
