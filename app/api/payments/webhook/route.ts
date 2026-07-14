import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { sendBookingConfirmation } from '@/lib/email';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const bookingId = intent.metadata.bookingId;
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'paid', status: 'confirmed', stripeChargeId: intent.latest_charge as string },
      include: { vehicle: { select: { name: true } }, user: true },
    });

    if (booking) {
      const email = booking.guestEmail || booking.user?.email;
      const name = booking.guestName || booking.user?.name || 'Customer';
      if (email) {
        await sendBookingConfirmation({
          to: email, name, reference: booking.reference,
          pickup: booking.pickup, dropoff: booking.dropoff,
          date: booking.date, time: booking.time,
          vehicle: booking.vehicle.name,
          totalPrice: booking.totalPrice, distance: booking.distance,
          paymentMethod: 'card',
        });
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const bookingId = intent.metadata.bookingId;
    if (bookingId) {
      await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: 'failed' } });
    }
  }

  return NextResponse.json({ received: true });
}
