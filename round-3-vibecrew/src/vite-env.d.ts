/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query';
declare global { interface Window { vibecrewQueryClient: QueryClient } }
