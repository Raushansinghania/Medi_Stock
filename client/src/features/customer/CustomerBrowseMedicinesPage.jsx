import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addToCart } from '@/store/slices/cartSlice';
import api from '@/lib/axios';
import {
  Pill,
  Search,
  Filter,
  Check,
  ShoppingCart,
  ShieldAlert,
  ShieldCheck,
  Building,
  Tag,
  ArrowUpDown,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MedicineDetailsModal from './MedicineDetailsModal';
import { cn } from '@/lib/utils';

export default function CustomerBrowseMedicinesPage() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [rxOnly, setRxOnly] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addedToastId, setAddedToastId] = useState(null);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data || [];
    },
  });

  // Fetch medicines
  const { data: medicineData, isLoading, refetch } = useQuery({
    queryKey: ['customer-browse-medicines', searchTerm, selectedCategory, inStockOnly, rxOnly, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedCategory) params.append('category', selectedCategory);
      if (inStockOnly) params.append('inStock', 'true');
      if (rxOnly !== '') params.append('prescriptionRequired', rxOnly);
      if (sortBy) params.append('sort', sortBy);
      params.append('limit', '100');

      const res = await api.get(`/medicines?${params.toString()}`);
      return res.data || [];
    },
  });

  const medicines = medicineData || [];

  // Check URL query param ?id=... to auto-open medicine modal
  const targetId = searchParams.get('id');
  useEffect(() => {
    if (targetId && medicines.length > 0) {
      const match = medicines.find((m) => String(m.id) === String(targetId));
      if (match) {
        setSelectedMedicine(match);
        setIsModalOpen(true);
      }
    }
  }, [targetId, medicines]);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Browse Medicine Catalogue</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Certified pharmaceutical formulations available for online order and prescription fulfillment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 bg-teal-50 text-teal-800 font-semibold rounded-full border border-teal-200">
            {medicines.length} Formulations Available
          </span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, brand, active salt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-slate-800"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none text-slate-800"
            >
              <option value="">All Formulation Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.category_name}>
                  {cat.category_name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none text-slate-800"
            >
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {/* In-Stock Filter Toggle */}
          <div className="md:col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded-md text-teal-600 focus:ring-teal-500 border-slate-300"
              />
              In Stock Only
            </label>
          </div>
        </div>

        {/* Quick Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('')}
            className={cn(
              'px-3 py-1 rounded-full whitespace-nowrap font-semibold transition-colors',
              selectedCategory === ''
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.category_name)}
              className={cn(
                'px-3 py-1 rounded-full whitespace-nowrap font-semibold transition-colors',
                selectedCategory === c.category_name
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {c.category_name}
            </button>
          ))}
        </div>
      </div>

      {/* Medicines Grid */}
      {isLoading ? (
        <div className="py-24 text-center">
          <LoadingSpinner size="lg" text="Searching medicines catalog in MySQL..." />
        </div>
      ) : medicines.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No medicines found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            We couldn't find any medications matching your query. Try clearing filters or searching by active generic name.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('');
              setInStockOnly(false);
              setRxOnly('');
            }}
            className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs"
          >
            Reset All Filters
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
                className="bg-white rounded-2xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
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

                  {/* Thumbnail / Icon & Name */}
                  <div className="flex items-start gap-3 my-2">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 line-clamp-1 leading-snug">
                        {med.medicine_name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {med.manufacturer} {med.strength && `• ${med.strength}`}
                      </p>
                    </div>
                  </div>

                  {/* Composition preview */}
                  {med.composition && (
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-1.5 font-mono bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      {med.composition}
                    </p>
                  )}
                </div>

                {/* Price, Stock status, & Quick Add */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-baseline justify-between mb-2.5">
                    <div>
                      <span className="text-base font-black text-slate-900">
                        ${price.toFixed(2)}
                      </span>
                      {mrp > price && (
                        <span className="text-[11px] text-slate-400 line-through ml-1.5">
                          ${mrp.toFixed(2)}
                        </span>
                      )}
                    </div>
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

      {/* Reusable Medicine Details Modal */}
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
