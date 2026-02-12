
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hwrcuwjbgndtfldvpedn.supabase.co';
const supabaseKey = 'sb_publishable_RqeyrvtO8Azsm5k1cIwI_g_sdfziDn5';

export const supabase = createClient(supabaseUrl, supabaseKey);
