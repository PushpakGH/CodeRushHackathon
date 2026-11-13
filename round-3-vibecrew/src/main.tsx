import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import shellMarkup from './legacy-shell.html?raw';
import { htmlToReact } from './htmlToReact';
import './supabase-adapter';
import '../styles.css';
import '../supabase-config.js';
import { setTheme, store } from './store';
import type { RootState } from './store';
import { InviteDialog } from './InviteDialog';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } },
});
window.vibecrewQueryClient = queryClient;

function RuntimeBootstrap() {
  useEffect(() => {
    // @ts-expect-error The old behavior adapter is being loaded as a bundled module while its handlers are ported.
    import('../app.js').catch(error => console.error('VibeCrew startup failed.', error));
  }, []);
  return null;
}

function ThemeBridge() {
  const theme = useSelector((state: RootState) => state.theme.value);
  const dispatch = useDispatch();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('vibecrew-preview-theme', theme); } catch { /* Keep the selected theme for this page session. */ }
    const onTheme = (event: Event) => {
      const next = (event as CustomEvent<'light' | 'dark'>).detail;
      if (next === 'light' || next === 'dark') dispatch(setTheme(next));
    };
    window.addEventListener('vibecrew:theme', onTheme);
    return () => window.removeEventListener('vibecrew:theme', onTheme);
  }, [dispatch, theme]);
  return null;
}

function App() {
  const shell = shellMarkup.replace(/<dialog class="modal invite-modal"[\s\S]*?<\/dialog>\s*/, '');
  return <Provider store={store}><QueryClientProvider client={queryClient}>{htmlToReact(shell)}<InviteDialog /><ThemeBridge /><RuntimeBootstrap /></QueryClientProvider></Provider>;
}

createRoot(document.getElementById('root')!).render(<App />);
