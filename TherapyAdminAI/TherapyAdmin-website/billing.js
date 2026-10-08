// ============================================================
// TherapyAdmin AI — billing.js
// Billing Integration supporting Stripe and Fallback Developer Mocks
// ============================================================

const db = require('./db');

let stripeInstance = null;
const isMockMode = !process.env.STRIPE_SECRET_KEY || 
                   process.env.STRIPE_SECRET_KEY.includes('mock') || 
                   process.env.STRIPE_SECRET_KEY === '';

// Gracefully try to import the Stripe package
if (!isMockMode) {
  try {
    const Stripe = require('stripe');
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('[BILLING] Running in live Stripe mode');
  } catch (err) {
    console.warn('[BILLING] Stripe npm package not installed. Defaulting to mock mode.');
  }
} else {
  console.log('[BILLING] Running in mock development billing mode');
}

// Price mapping from env
const PRICES = {
  starter: process.env.PRICE_STARTER || 'price_starter_mock',
  professional: process.env.PRICE_PRO || 'price_pro_mock',
  group: process.env.PRICE_GROUP || 'price_group_mock',
  trial: 'trial'
};

/**
 * Creates a checkout session for a given plan and subscription period.
 * @param {object} user User object from auth middleware
 * @param {string} plan Plan name (starter, professional, group)
 * @param {boolean} isAnnual Annual discount flag
 * @returns {Promise<{url: string, sessionId?: string}>} Checkout URL
 */
async function createCheckoutSession(user, plan, isAnnual) {
  const normalizedPlan = plan.toLowerCase();
  
  if (isMockMode || !stripeInstance) {
    // Generate mock checkout redirect URL
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const mockSuccessUrl = `${appUrl}/api/billing/mock-checkout-success?userId=${user.id}&plan=${normalizedPlan}`;
    return { url: mockSuccessUrl, sessionId: 'mock_session_' + Date.now() };
  }

  // Real Stripe Implementation
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const priceId = PRICES[normalizedPlan];
  
  if (!priceId || priceId.includes('mock')) {
    throw new Error(`Invalid or missing Price ID for plan: ${normalizedPlan}`);
  }

  try {
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: user.email,
      success_url: `${appUrl}/dashboard.html?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing.html?checkout_cancelled=true`,
      metadata: {
        userId: user.id.toString(),
        plan: normalizedPlan
      }
    });

    return { url: session.url, sessionId: session.id };
  } catch (err) {
    console.error('[STRIPE CHECKOUT ERROR]', err);
    throw new Error('Stripe checkout session creation failed');
  }
}

/**
 * Generates a billing customer portal session URL or fallback mock URL.
 * @param {object} user User object
 * @returns {Promise<{url: string}>} Portal URL
 */
async function createPortalSession(user) {
  if (isMockMode || !stripeInstance) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return { url: `${appUrl}/billing.html?portal_message=mock_portal_access` };
  }

  // For real implementation, retrieve or create the user's stripe customer id.
  // In our simplified schema, we use the user's email to lookup/create customer.
  try {
    const customers = await stripeInstance.customers.list({
      email: user.email,
      limit: 1
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      // Create new customer if not found
      const customer = await stripeInstance.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id.toString() }
      });
      customerId = customer.id;
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const portalSession = await stripeInstance.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard.html`
    });

    return { url: portalSession.url };
  } catch (err) {
    console.error('[STRIPE PORTAL ERROR]', err);
    throw new Error('Stripe billing portal session creation failed');
  }
}

/**
 * Processes incoming Stripe webhook events
 * @param {Buffer} rawBody Buffer containing the raw request body
 * @param {string} signature Header signature
 * @returns {Promise<{status: string}>}
 */
async function handleWebhook(rawBody, signature) {
  if (isMockMode || !stripeInstance) {
    return { status: 'ignored_in_mock_mode' };
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(rawBody, signature, endpointSecret);
  } catch (err) {
    console.error('[STRIPE WEBHOOK VALIDATION ERROR]', err.message);
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  // Handle specific event types
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = parseInt(session.metadata.userId, 10);
      const plan = session.metadata.plan;
      
      if (userId && plan) {
        await db.updateUserPlan(userId, plan);
        console.log(`[STRIPE WEBHOOK] User ${userId} upgraded to ${plan}`);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      // Fetch customer metadata
      try {
        const customer = await stripeInstance.customers.retrieve(subscription.customer);
        if (customer && customer.metadata && customer.metadata.userId) {
          const userId = parseInt(customer.metadata.userId, 10);
          await db.updateUserPlan(userId, 'trial'); // Downgrade back to trial
          console.log(`[STRIPE WEBHOOK] User ${userId} downgraded to trial (subscription deleted)`);
        }
      } catch (err) {
        console.error('[STRIPE WEBHOOK CUSTOMER RETRIEVAL ERROR]', err);
      }
      break;
    }
    default:
      console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
  }

  return { status: 'success' };
}

module.exports = {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  isMockMode: () => isMockMode
};
