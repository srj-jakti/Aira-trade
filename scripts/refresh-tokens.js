const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

async function triggerAutoLogin() {
  console.log('Triggering auto-login...');
  try {
    const response = await fetch(`${supabaseUrl.replace('.supabase.co', '.supabase.co')}/functions/v1/zerodha-auto-login`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ triggerType: 'manual' })
    }).catch(err => {
        // Fallback to local API if function not found or failing
        return fetch('http://localhost:3000/api/cron/zerodha-auto-login', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ triggerType: 'manual' })
        });
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

triggerAutoLogin();
