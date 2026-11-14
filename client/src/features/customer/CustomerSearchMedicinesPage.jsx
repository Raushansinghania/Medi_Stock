import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToCart } from '@/store/slices/cartSlice';
import api from '@/lib/axios';
import {
  Search,
  Pill,
  Check,
  ShoppingCart,
  ShieldAlert,
  ShieldCheck,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MedicineDetailsModal from './MedicineDetailsModal';
import { cn } from '@/lib/utils';

export default function CustomerSearchMedicinesPage() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [inputVal, setInputVal] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addedToastId, setAddedToastId] = useState(null);

  // Sync debounced query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(inputVal.trim());
      if (inputVal.trim()) {
        setSearchParams({ q: inputVal.trim() });
      } else {
        setSearchParams({});
      }
    }, 280);
    return () => clearTimeout(handler);
  }, [inputVal, setSearchParams]);

  // Fetch search results
  const { data: searchResults, isLoading, isError } = useQuery({
    queryKey: ['customer-search-query', debouncedQuery],
    queryFn: async () => {
      const param = debouncedQuery ? `?search=${encodeURIComponent(debouncedQuery)}` : '';
      const res = await api.get(`/medicines${param}`);
      return res.data || [];
    },
  });

  const medicines = searchResults || [];

  const handleQuickAdd = (e, med) => {
    e.stopPropagation();
    if (med.quantity <= 0) return;
    dispatch(
      addToCart({
        medicine_id: med.id,
        medicine_name: med.medicine_name,
        strength: med.strength,
        dosage_form: med.dosage_form,
        category: med.category,
        selling_price: Number(med.selling_price),
        is_prescription_required: med.is_prescription_required,
        max_stock: med.quantity,
        quantity: 1,
      })
    );
    setAddedToastId(med.id);
    setTimeout(() => setAddedToastId(null), 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Search Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            Real-time MySQL Medicine Search
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Search Authentic Pharmacy Medications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Find prescription medicines, fever reducers, antibiotics, and OTC formulations by generic salt or brand name.
          </p>

          <div className="relative pt-2">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-5" />
            <input
              type="text"
              placeholder="Search by medicine name, brand, active salt, strength (e.g. Paracetamol, Amoxicillin)..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-full pl-12 pr-10 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-100 outline-none transition-all text-slate-900 shadow-xs"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => setInputVal('')}
                className="absolute right-3.5 top-5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {debouncedQuery ? `Search Results for "${debouncedQuery}"` : 'All Available Medications'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {medicines.length} matching formulation{medicines.length !== 1 ? 's' : ''} in stock
          </p>
        </div>
      </div>

      {/* Search Results Grid */}
      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Searching medicines catalog..." />
        </div>
      ) : medicines.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No medicines found for "{debouncedQuery}"</h3>
          <p className="text-xs text-slate-500 mt-1">
            We couldn't find any medicine matching this exact term. Please check the spelling or search by the generic salt name (e.g. "Paracetamol", "Amoxicillin", "Omeprazole").
          </p>
          <button
            type="button"
            onClick={() => setInputVal('')}
            className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {medicines.map((med) => {
            const price = Number(med.selling_price || 0);
            const mrp = Number(med.mrp || price);
            const isOutOfStock = med.quantity <= 0 || med.stock_status === 'out_of_stock';
            const isAdded = addedToastId === med.id;

            return (
              <div
                key={med.id}
                onClick={() => {
                  setSelectedMedicine(med);
                  setIsModalOpen(true);
                }}
                className="bg-white rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 truncate max-w-[120px]">
                      {med.category || 'Medicine'}
                    </span>
                    {med.is_prescription_required ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Rx Required
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 text-emerald-700">
                        OTC
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3 my-2">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 line-clamp-1">
                        {med.medicine_name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {med.manufacturer} {med.strength && `• ${med.strength}`}
                      </p>
                    </div>
                  </div>

                  {med.composition && (
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-1.5 font-mono bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      {med.composition}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-baseline justify-between mb-2.5">
                    <span className="text-base font-black text-slate-900">${price.toFixed(2)}</span>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase',
                        med.stock_status === 'in_stock'
                          ? 'text-emerald-600'
                          : med.stock_status === 'low_stock'
                          ? 'text-amber-600'
                          : 'text-red-500'
                      )}
                    >
                      {med.stock_status.replace('_', ' ')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleQuickAdd(e, med)}
                    disabled={isOutOfStock || isAdded}
                    className={cn(
                      'w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                      isAdded
                        ? 'bg-emerald-600 text-white'
                        : isOutOfStock
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                    )}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Added
                      </>
                    ) : isOutOfStock ? (
                      'Out of Stock'
                    ) : (
                      <>
                        <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Medicine Details Modal */}
      <MedicineDetailsModal
        medicine={selectedMedicine}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMedicine(null);
        }}
      />
    </div>
  );
}
