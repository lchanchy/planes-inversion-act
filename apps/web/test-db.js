const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if(k && v) acc[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Note: ANON_KEY won't be able to delete if RLS is enabled and there is no user session.
async function run() {
  const { error } = await supabase.from('material_catalog').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) console.error('Error deleting:', error);
  else console.log('Successfully deleted all materials');
}
run();
