import { createClient } from '@supabase/supabase-js';

declare global { interface Window { supabase?: { createClient: typeof createClient } } }
window.supabase = { createClient };
