import { createSlice } from '@reduxjs/toolkit';

const loadCart = () => {
  try {
    const saved = localStorage.getItem('medistock_customer_cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveCart = (items) => {
  try {
    localStorage.setItem('medistock_customer_cart', JSON.stringify(items));
  } catch {
    // ignore
  }
};

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: loadCart(),
  },
  reducers: {
    addToCart: (state, action) => {
      const item = action.payload;
      const existing = state.items.find((i) => i.medicine_id === item.medicine_id);
      if (existing) {
        existing.quantity += item.quantity || 1;
        existing.subtotal = Math.round(existing.quantity * existing.unit_price * 100) / 100;
      } else {
        state.items.push({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          strength: item.strength,
          dosage_form: item.dosage_form,
          category: item.category,
          unit_price: Number(item.unit_price || item.selling_price || 0),
          quantity: item.quantity || 1,
          is_prescription_required: Boolean(item.is_prescription_required),
          max_stock: item.max_stock || item.quantity || 99,
          subtotal: Math.round((item.quantity || 1) * Number(item.unit_price || item.selling_price || 0) * 100) / 100,
        });
      }
      saveCart(state.items);
    },
    updateQuantity: (state, action) => {
      const { medicine_id, quantity } = action.payload;
      const target = state.items.find((i) => i.medicine_id === medicine_id);
      if (target) {
        if (quantity <= 0) {
          state.items = state.items.filter((i) => i.medicine_id !== medicine_id);
        } else {
          target.quantity = quantity;
          target.subtotal = Math.round(quantity * target.unit_price * 100) / 100;
        }
      }
      saveCart(state.items);
    },
    removeFromCart: (state, action) => {
      const medicine_id = action.payload;
      state.items = state.items.filter((i) => i.medicine_id !== medicine_id);
      saveCart(state.items);
    },
    clearCart: (state) => {
      state.items = [];
      saveCart([]);
    },
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
