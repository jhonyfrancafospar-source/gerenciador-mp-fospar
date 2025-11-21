
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oewyykuacdvfrvhmqrei.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ld3l5a3VhY2R2ZnJ2aG1xcmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzcxODIsImV4cCI6MjA3OTMxMzE4Mn0.y76QhgjQ7dfizD-uS_kSlwuyqStQOpp78_pyWQEwRwI';

export const supabase = createClient(supabaseUrl, supabaseKey);
