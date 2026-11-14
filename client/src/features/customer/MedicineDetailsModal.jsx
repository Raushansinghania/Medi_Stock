import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToCart } from '@/store/slices/cartSlice';
import {
  X,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Check,
  ShoppingCart,
  Plus,
  Minus,
  Building,
  Tag,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MedicineDetailsModal({ medicine, isOpen, onClose }) {
  const dispatch = useDispatch();
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);

  if (!isOpen || !medicine) return null;

  const isOutOfStock = medicine.quantity <= 0 || medicine.stock_status === 'out_of_stock';
  const price = Number(medicine.selling_price || 0);
  const mrp = Number(medicine.mrp || price);
  const hasDiscount = mrp > price;
  const discountPercent = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    dispatch(
      addToCart({
        medicine_id: medicine.id,
        medicine_name: medicine.medicine_name,
        strength: medicine.strength,
        dosage_form: medicine.dosage_form,
        category: medicine.category,
        selling_price: price,
        is_prescription_required: medicine.is_prescription_required,
        max_stock: medicine.quantity || 99,
        quantity,
      })
    );
    setAddedToast(true);
    setTimeout(() => {
      setAddedToast(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xl shadow-xs">
              <Pill className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 uppercase tracking-wider">
                  {medicine.category || 'General'}
                </span>
                {medicine.dosage_form && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {medicine.dosage_form}
                  </span>
                )}
                {medicine.is_prescription_required ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-amber-600" /> Rx Prescription Required
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Over the Counter (OTC)
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{medicine.medicine_name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
          {/* Price & Stock Header */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Retail Pharmacy Price</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">${price.toFixed(2)}</span>
                {hasDiscount && (
                  <>
                    <span className="text-sm text-slate-400 line-through">${mrp.toFixed(2)}</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      Save {discountPercent}%
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-medium block">Availability</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mt-1',
                  medicine.stock_status === 'in_stock'
                    ? 'bg-emerald-100 text-emerald-800'
                    : medicine.stock_status === 'low_stock'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                )}
              >
                {medicine.stock_status === 'in_stock'
                  ? 'In Stock'
                  : medicine.stock_status === 'low_stock'
                  ? 'Low Stock (Only few left)'
                  : 'Out of Stock'}
              </span>
            </div>
          </div>

          {/* Composition & Strength */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-slate-400 block font-medium">Manufacturer / Brand</span>
              <span className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-teal-600" />
                {medicine.manufacturer || 'Verified Manufacturer'}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="text-slate-400 block font-medium">Strength / Potency</span>
              <span className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-teal-600" />
                {medicine.strength || 'Standard Dosage'}
              </span>
            </div>
          </div>

          {/* Active Chemical Composition */}
          {medicine.composition && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Active Chemical Composition
              </h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed font-mono">
                {medicine.composition}
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Medical Description & Indications
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
              {medicine.description ||
                'This pharmaceutical formulation is dispensed in strict accordance with regulated good pharmacy practice standards. Store in a cool, dry place below 25°C away from direct sunlight.'}
            </p>
          </div>

          {/* Prescription Warning Box */}
          {medicine.is_prescription_required ? (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Pharmacist Prescription Verification Required</span>
                <span className="text-[11px] text-amber-700 mt-0.5 block">
                  You can order this medicine now, but a valid doctor prescription must be attached during checkout for our licensed pharmacist to review and approve before fulfillment.
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer with Quantity & Add to Cart */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Quantity:</span>
            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1 || isOutOfStock}
                className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 text-center text-xs font-bold text-slate-800">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                disabled={isOutOfStock}
                className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock || addedToast}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-bold text-xs shadow-sm transition-all',
              addedToast
                ? 'bg-emerald-600 text-white'
                : isOutOfStock
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white hover:shadow-md'
            )}
          >
            {addedToast ? (
              <>
                <Check className="w-4 h-4" /> Added to Cart!
              </>
            ) : isOutOfStock ? (
              'Currently Out of Stock'
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" /> Add ${(price * quantity).toFixed(2)} to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
