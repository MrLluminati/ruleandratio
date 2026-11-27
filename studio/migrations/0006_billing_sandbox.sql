-- Test-only billing ledger. No plans, prices, links or settings seeded.
CREATE TABLE billing_sandbox_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 razorpay_account_id TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
CREATE TABLE billing_plans (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 period TEXT NOT NULL CHECK(period IN ('monthly','annual')),
 amount_paise INTEGER NOT NULL CHECK(amount_paise>0),
 currency TEXT NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 provider_plan_id TEXT NOT NULL UNIQUE,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
CREATE TABLE billing_subscriptions (
 id TEXT PRIMARY KEY,
 member_id TEXT NOT NULL REFERENCES member_profiles(id),
 plan_id TEXT NOT NULL REFERENCES billing_plans(id),
 provider_subscription_id TEXT NOT NULL UNIQUE,
 expected_amount_paise INTEGER NOT NULL CHECK(expected_amount_paise>0),
 checkout_url TEXT,
 checkout_expires_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE INDEX billing_subscriptions_member ON billing_subscriptions(member_id);
CREATE TABLE billing_event_details (
 provider TEXT NOT NULL DEFAULT 'razorpay-test',
 event_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 subscription_id TEXT REFERENCES billing_subscriptions(id),
 payment_id TEXT,
 occurred_at INTEGER NOT NULL,
 PRIMARY KEY(provider,event_id),
 FOREIGN KEY(provider,event_id) REFERENCES billing_events(provider,event_id)
);
CREATE TABLE billing_charges (
 payment_id TEXT PRIMARY KEY,
 invoice_id TEXT NOT NULL UNIQUE,
 subscription_id TEXT NOT NULL REFERENCES billing_subscriptions(id),
 cycle_number INTEGER NOT NULL CHECK(cycle_number>0),
 amount_paise INTEGER NOT NULL CHECK(amount_paise>0),
 period_start INTEGER NOT NULL,
 period_end INTEGER NOT NULL CHECK(period_end>period_start),
 verified_at INTEGER NOT NULL,
 UNIQUE(subscription_id,cycle_number)
);
CREATE TABLE billing_refund_holds (
 payment_id TEXT PRIMARY KEY,
 refund_id TEXT NOT NULL,
 recorded_at INTEGER NOT NULL
);
CREATE TABLE billing_cancellation_requests (
 subscription_id TEXT PRIMARY KEY REFERENCES billing_subscriptions(id),
 requested_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','rejected')),
 resolved_at INTEGER
);
