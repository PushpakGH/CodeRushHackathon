import { configureStore, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

let savedTheme = '';
try { savedTheme = localStorage.getItem('vibecrew-preview-theme') || ''; } catch { /* Storage may be blocked in private browsing. */ }
const themeSlice = createSlice({
  name: 'theme',
  initialState: { value: savedTheme === 'light' ? 'light' : 'dark' },
  reducers: { setTheme: (state, action: PayloadAction<'light' | 'dark'>) => { state.value = action.payload; } },
});

export const { setTheme } = themeSlice.actions;
export const store = configureStore({ reducer: { theme: themeSlice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
