import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  username: string | null;
  email: string | null;
  isAuthenticated: boolean;
}

const token = localStorage.getItem('token');
const username = localStorage.getItem('username');
const email = localStorage.getItem('email');

const initialState: AuthState = {
  token,
  username,
  email,
  isAuthenticated: !!token,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string; username: string; email: string }>
    ) => {
      state.token = action.payload.token;
      state.username = action.payload.username;
      state.email = action.payload.email;
      state.isAuthenticated = true;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('username', action.payload.username);
      localStorage.setItem('email', action.payload.email);
    },
    logout: (state) => {
      state.token = null;
      state.username = null;
      state.email = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('email');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
