const { createClient } = require('@supabase/supabase-js');

// Load env vars manually since we are running a script
const url = "https://xdxpnzcgzinjelnuyigm.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkeHBuemNnemluamVsbnV5aWdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg2OTczMywiZXhwIjoyMDgzNDQ1NzMzfQ.l5Vejx2Ni9CHSFhoGgXB4_HBlrDnInMgE73wNqaBv9c";

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const email = process.argv[2] || "costumerservicee59@gmail.com"; // Default from screenshot

async function setAdmin() {
  console.log(`Promoting user ${email} to admin...`);
  
  // 1. Get user ID from auth.users (we can't query auth.users directly easily via client usually, 
  // but service role can query profiles directly if we join, but easier to just search profile by email if stored there)
  // Wait, profiles table has email column based on schema.sql I read earlier:
  // create table public.profiles ( id uuid ... email text ... )
  
  const { data: users, error: findError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email);

  if (findError) {
    console.error("Error finding user:", findError);
    return;
  }

  if (!users || users.length === 0) {
    console.error("User not found in profiles table. Make sure they have registered and logged in once.");
    return;
  }

  const user = users[0];
  console.log(`Found user: ${user.id} (Current role: ${user.role})`);

  if (user.role === 'admin') {
    console.log("User is already an admin.");
    return;
  }

  // 2. Update role
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id);

  if (updateError) {
    console.error("Failed to update role:", updateError);
  } else {
    console.log("Successfully promoted user to admin!");
  }
}

setAdmin();
