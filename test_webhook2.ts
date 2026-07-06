import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
const secret = "whsec_12345678901234567890123456789012";
try {
  const wh = new Webhook(secret);
  console.log("Success with whsec_");
} catch (e: any) {
  console.log("Error with whsec_:", e.message);
}
