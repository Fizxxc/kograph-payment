const crypto = require('crypto');

const streamKey = "77c17eab8aaedd4276e490dd37a99ac1"; // From your .env
const checkoutId = "173f2404-a665-4d73-a0b7-e74f0fb2bd68"; // From your screenshot
const url = "http://localhost:3000/api/saweria/callback";

const payload = {
  version: "v2",
  created_at: new Date().toISOString(),
  id: "evt_" + crypto.randomBytes(8).toString('hex'),
  type: "donation",
  amount_raw: 1000,
  cut: 58, // Example cut
  donator_name: "Fizzx",
  donator_email: "costumerservicee59@gmail.com",
  message: `KO:${checkoutId} Semangat!`
};

// Calculate signature
const msg = `${payload.version}${payload.id}${payload.amount_raw}${payload.donator_name}${payload.donator_email}`;
const signature = crypto.createHmac('sha256', streamKey).update(msg).digest('hex');

async function simulate() {
  console.log("Simulating Saweria Webhook...");
  console.log("Target:", url);
  console.log("Checkout ID:", checkoutId);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'saweria-callback-signature': signature
      },
      body: JSON.stringify(payload)
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);

    if (res.ok) {
      console.log("\n✅ SUCCESS! Webhook processed successfully.");
      console.log("Check your dashboard, the balance should be updated.");
    } else {
      console.log("\n❌ FAILED. Check the error message above.");
    }
  } catch (err) {
    console.error("Network Error:", err.message);
    console.log("Make sure your Next.js server is running on port 3000!");
  }
}

simulate();
