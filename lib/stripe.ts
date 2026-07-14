import Stripe from 'stripe';

// Allow placeholder value during build, but will fail at runtime if not properly configured
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

if (stripeKey === 'sk_test_placeholder' && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: STRIPE_SECRET_KEY is using placeholder value. Please configure it in Vercel dashboard.');
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-06-20',
});

export default stripe;

export async function createPaymentIntent(
  amount: number, // in dollars
  metadata: Record<string, string>
) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // convert to cents
    currency: 'usd',
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

export async function refundPayment(paymentIntentId: string, amount?: number) {
  const params: Stripe.RefundCreateParams = { payment_intent: paymentIntentId };
  if (amount) params.amount = Math.round(amount * 100);
  return stripe.refunds.create(params);
}
