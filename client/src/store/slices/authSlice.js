import { createSlice } from '@reduxjs/toolkit';

const initialUser = (() => {
  try {
    const saved = localStorage.getItem('medistock_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
})();

const initialState = {
  user: initialUser,
  token: localStorage.getItem('medistock_token') || null,
  isAuthenticated: !!initialUser,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token || null;
      state.error = null;
      if (action.payload.user) {
        localStorage.setItem('medistock_user', JSON.stringify(action.payload.user));
      }
      if (action.payload.token) {
        localStorage.setItem('medistock_token', action.payload.token);
      }
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.error = action.payload;
      localStorage.removeItem('medistock_user');
      localStorage.removeItem('medistock_token');
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      localStorage.removeItem('medistock_user');
      localStorage.removeItem('medistock_token');
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      if (action.payload) {
        localStorage.setItem('medistock_user', JSON.stringify(action.payload));
      } else {
        localStorage.removeItem('medistock_user');
      }
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, setUser } = authSlice.actions;
export default authSlice.reducer;
