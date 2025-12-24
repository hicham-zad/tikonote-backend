#!/bin/bash

# Stripe Integration Local Testing Script
# This script helps you test the Stripe integration locally

echo "═══════════════════════════════════════════════════════"
echo "🧪 STRIPE INTEGRATION LOCAL TESTING"
echo "═══════════════════════════════════════════════════════"
echo ""

# Step 1: Run database migration
echo "📊 Step 1: Database Migration"
echo "----------------------------------------"
echo "1. Open Supabase Dashboard → SQL Editor"
echo "2. Copy contents from: backend/migrations/add_subscription_tracking_fields.sql"
echo "3. Execute the migration"
echo "4. Verify columns added: subscription_source, expires_at"
echo ""
read -p "Press Enter when migration is complete..."
echo ""

# Step 2: Set up Stripe CLI for local webhook testing
echo "🔧 Step 2: Stripe CLI Setup"
echo "----------------------------------------"
echo "Installing/Running Stripe CLI..."
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "⚠️  Stripe CLI not found. Install it with:"
    echo "   brew install stripe/stripe-cli/stripe"
    echo ""
    read -p "Press Enter after installing Stripe CLI..."
fi

# Login to Stripe
echo "Logging in to Stripe..."
stripe login

# Start webhook forwarding
echo ""
echo "Starting webhook forwarding to localhost:3002..."
echo "Copy the webhook signing secret (whsec_...) and add to backend/.env"
echo ""
stripe listen --forward-to localhost:3002/api/stripe/webhook &
STRIPE_PID=$!

echo ""
read -p "Press Enter after adding STRIPE_WEBHOOK_SECRET to .env..."
echo ""

# Step 3: Test payment
echo "💳 Step 3: Test Payment"
echo "----------------------------------------"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click 'Upgrade' button"
echo "3. Select a plan (Weekly/Monthly/Yearly)"
echo "4. Use test card: 4242 4242 4242 4242"
echo "5. Complete checkout"
echo ""
read -p "Press Enter after completing test payment..."
echo ""

# Step 4: Verify webhook
echo "🔔 Step 4: Verify Webhook"
echo "----------------------------------------"
echo "Check backend terminal for:"
echo "  - 🔔 STRIPE WEBHOOK RECEIVED"
echo "  - Event Type: checkout.session.completed"
echo "  - 💾 UPDATING DATABASE"
echo "  - ✅ Database updated successfully"
echo ""
read -p "Press Enter to continue..."
echo ""

# Step 5: Check database
echo "📊 Step 5: Check Database"
echo "----------------------------------------"
echo "1. Open Supabase → Table Editor → user_profiles"
echo "2. Find your test user"
echo "3. Verify fields:"
echo "   - subscription_plan: unlimited"
echo "   - subscription_status: active"
echo "   - subscription_plan_type: weekly/monthly/yearly"
echo "   - subscription_source: stripe"
echo "   - expires_at: (future date)"
echo "   - product_identifier: (price ID)"
echo ""
read -p "Press Enter to continue..."
echo ""

# Step 6: Test customer portal
echo "🔐 Step 6: Test Customer Portal"
echo "----------------------------------------"
echo "Testing customer portal session creation..."
echo ""

# Test customer portal endpoint
curl -X POST http://localhost:3002/api/stripe/create-portal-session \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-123", "email": "test@example.com"}' \
  | jq '.'

echo ""
echo "Copy the 'url' from above and open it in your browser"
echo "You should see the Stripe Customer Portal"
echo ""
read -p "Press Enter to finish..."
echo ""

# Cleanup
echo "🧹 Cleaning up..."
kill $STRIPE_PID 2>/dev/null

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ TESTING COMPLETE!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review next_steps_checklist.md for remaining tasks"
echo "2. Configure production webhook in Stripe Dashboard"
echo "3. Test cross-platform sync (mobile ↔ web)"
echo "4. Deploy to production"
echo ""
