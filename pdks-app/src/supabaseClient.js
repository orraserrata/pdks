import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adpopdmavlseifoxpobo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG9wZG1hdmxzZWlmb3hwb2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5ODQ2MjMsImV4cCI6MjA3MDU2MDYyM30.Sv1EK6_IC12bO7vNtB2vY9R-H2ot5x0Rg0XmCWgmdVM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
