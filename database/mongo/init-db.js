// MongoDB Multi-tenant SaaS Schema Initialization (mongosh compatible)
// Safe to run multiple times; uses collMod for validators and checks for existing indexes.

// Helper: ensure collection exists and apply validator idempotently
function ensureCollection(name, validator) {
  const exists = db.getCollectionInfos({ name }).length > 0

  if (!exists) {
    db.createCollection(name, {
      validator,
      validationLevel: 'moderate',
      validationAction: 'error'
    })
    print(`Collection '${name}' created.`)
  } else if (validator) {
    db.runCommand({
      collMod: name,
      validator,
      validationLevel: 'moderate',
      validationAction: 'error'
    })
    print(`Collection '${name}' updated (validator).`)
  }
}

// Helper: compare index spec and options, then create if missing
function hasIndex(collName, keys, opts = {}) {
  const indexes = db.getCollection(collName).getIndexes()

  return indexes.some(idx => {
    const sameKeys =
      Object.keys(keys).length === Object.keys(idx.key).length &&
      Object.keys(keys).every(k => idx.key[k] === keys[k])

    if (!sameKeys) return false

    if (opts.unique && !idx.unique) return false

    if (opts.partialFilterExpression) {
      const a = JSON.stringify(opts.partialFilterExpression)
      const b = JSON.stringify(idx.partialFilterExpression || {})

      if (a !== b) return false
    }

    return true
  })
}

function ensureIndex(collName, keys, opts = {}) {
  if (!hasIndex(collName, keys, opts)) {
    db.getCollection(collName).createIndex(keys, opts)
    print(`Index created on '${collName}': ${JSON.stringify(keys)}`)
  } else {
    print(`Index already exists on '${collName}': ${JSON.stringify(keys)}`)
  }
}

function dropUniqueIndexesOnFields(collName, fields) {
  const idxs = db.getCollection(collName).getIndexes()

  idxs.forEach(idx => {
    const keys = Object.keys(idx.key || {})
    const hasField = keys.some(k => fields.includes(k))

    if (idx.unique && hasField) {
      db.getCollection(collName).dropIndex(idx.name)
      print(`Index dropped on '${collName}': ${idx.name}`)
    }
  })
}

/* =========================
   1) users
   Stores auth-independent user profile with email uniqueness.
   Supports super admin flag and status management.
   ========================= */
const usersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['email', 'name', 'status', 'createdAt', 'updatedAt'],
    properties: {
      email: { bsonType: 'string' },
      name: { bsonType: 'string' },
      avatarUrl: { bsonType: 'string' },
      image: { bsonType: ['string', 'null'] },
      countryCode: { bsonType: ['string', 'null'], pattern: '^\\+[0-9]{1,3}$' },
      mobile: { bsonType: ['string', 'null'], pattern: '^[0-9]{8,10}$' },
      notifyMe: { bsonType: 'bool' },
      isSuperAdmin: { bsonType: 'bool' },
      status: { enum: ['active', 'suspended'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('users', usersValidator)

// Indexes
ensureIndex('users', { email: 1 }, { unique: true, name: 'uniq_email' })


/* =========================
   2) authAccounts
   External and local auth account links per user.
   Supports Google now and Facebook / Apple / Email later.
   ========================= */
const authAccountsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'provider', 'providerUserId', 'email', 'createdAt'],
    properties: {
      userId: { bsonType: 'objectId' },
      provider: { enum: ['google', 'facebook', 'apple', 'email'] },
      providerUserId: { bsonType: 'string' },
      email: { bsonType: 'string' },
      passwordHash: { bsonType: ['string', 'null'] },
      createdAt: { bsonType: 'date' },
      lastLoginAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('authAccounts', authAccountsValidator)

// Indexes
ensureIndex(
  'authAccounts',
  { provider: 1, providerUserId: 1 },
  { unique: true, name: 'uniq_provider_providerUserId' }
)
ensureIndex('authAccounts', { userId: 1 }, { name: 'idx_userId' })


/* =========================
   3) tenants
   Tenant entities representing organizations or sole traders.
   Created by a user; has type and status.
   ========================= */
const tenantsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'type', 'status', 'createdBy', 'createdAt', 'updatedAt'],
    properties: {
      name: { bsonType: 'string' },
      type: { enum: ['sole_trader', 'company'] },
      status: { enum: ['active', 'suspended'] },
      createdBy: { bsonType: 'objectId' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
      subscriptionPlanId: { bsonType: 'objectId' },
      /* Billing / GST buyer profile (used on tax invoices) */
      legalName: { bsonType: ['string', 'null'] },
      gstin: { bsonType: ['string', 'null'] },
      pan: { bsonType: ['string', 'null'] },
      billingEmail: { bsonType: ['string', 'null'] },
      billingPhone: { bsonType: ['string', 'null'] },
      billingAddress: {
        bsonType: ['object', 'null'],
        properties: {
          line1: { bsonType: 'string' },
          line2: { bsonType: ['string', 'null'] },
          city: { bsonType: 'string' },
          state: { bsonType: 'string' },
          stateCode: { bsonType: 'string' },
          pincode: { bsonType: 'string' },
          country: { bsonType: 'string' }
        },
        additionalProperties: true
      },
      placeOfSupplyStateCode: { bsonType: ['string', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('tenants', tenantsValidator)

// Indexes
ensureIndex('tenants', { createdBy: 1 }, { name: 'idx_createdBy' })
ensureIndex('tenants', { status: 1 }, { name: 'idx_status' })
ensureIndex('tenants', { subscriptionPlanId: 1 }, { name: 'idx_subscriptionPlanId' })


/* =========================
   4) memberships
   Links users to tenants with roles and invitation lifecycle.
   userId is nullable until invite accepted; uniqueness applies only when userId exists.
   ========================= */
const membershipsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'role', 'status', 'createdAt'],
    properties: {
      userId: { bsonType: ['objectId', 'null'] },
      tenantId: { bsonType: 'objectId' },
      role: { enum: ['OWNER', 'ADMIN', 'USER'] },
      status: { enum: ['invited', 'active', 'revoked'] },
      invitedBy: { bsonType: 'objectId' },
      invitedAt: { bsonType: 'date' },
      activatedAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('memberships', membershipsValidator)

// Indexes
// Unique when userId is set to prevent multiple active memberships for the same user/tenant
ensureIndex(
  'memberships',
  { userId: 1, tenantId: 1 },
  {
    unique: true,
    name: 'uniq_user_tenant_when_user_exists',
    partialFilterExpression: { userId: { $type: 'objectId' } }
  }
)
ensureIndex('memberships', { tenantId: 1 }, { name: 'idx_tenantId' })
ensureIndex('memberships', { userId: 1 }, { name: 'idx_userId' })
ensureIndex('memberships', { status: 1 }, { name: 'idx_status' })


/* =========================
   5) auditLogs
   Immutable audit trail for privileged actions across tenants.
   ========================= */
const auditLogsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['actorUserId', 'action', 'targetTenantId', 'createdAt'],
    properties: {
      actorUserId: { bsonType: 'objectId' },
      action: {
        enum: [
          'IMPERSONATE_START',
          'IMPERSONATE_END',
          'ADMIN_VIEW',
          'LEAD_CREATED',
          'LEAD_LOAN_TYPE_CHANGED',
          'LEAD_ASSIGNED_AGENT_CHANGED',
          'LEAD_STATUS_CHANGED',
          'LEAD_REQUESTED_AMOUNT_CHANGED',
          'LEAD_DELETED',
          'DISBURSEMENT_TRACKER_CREATED',
          'DISBURSEMENT_RECORDED'
        ]
      },
      targetTenantId: { bsonType: 'objectId' },
      metadata: { bsonType: 'object' },
      createdAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('auditLogs', auditLogsValidator)

// Indexes
ensureIndex('auditLogs', { actorUserId: 1 }, { name: 'idx_actorUserId' })
ensureIndex('auditLogs', { targetTenantId: 1 }, { name: 'idx_targetTenantId' })
ensureIndex('auditLogs', { action: 1 }, { name: 'idx_action' })

const subscriptionPlansValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'slug', 'description', 'priceMonthly', 'maxUsers', 'createdAt', 'updatedAt'],
    properties: {
      name: { bsonType: 'string' },
      slug: { bsonType: 'string' },
      description: { bsonType: 'string' },
      priceMonthly: { bsonType: 'double' },
      priceYearly: { bsonType: ['double', 'null'] },
      currency: { bsonType: 'string' },
      maxUsers: { bsonType: 'int' },
      features: { bsonType: 'object' },
      entitlements: {
        bsonType: 'object',
        properties: {
          limits: { bsonType: 'object' },
          modules: { bsonType: 'object' }
        }
      },
      trialDays: { bsonType: 'int' },
      trialEnabled: { bsonType: 'bool' },
      entitlementsVersion: { bsonType: 'int' },
      /* Canonical amounts in paise (preferred); priceMonthly/Yearly kept for display/compat */
      priceMonthlyPaise: { bsonType: ['long', 'int', 'double', 'null'] },
      priceYearlyPaise: { bsonType: ['long', 'int', 'double', 'null'] },
      razorpayPlanIdMonthly: { bsonType: ['string', 'null'] },
      razorpayPlanIdYearly: { bsonType: ['string', 'null'] },
      isActive: { bsonType: 'bool' },
      isDefault: { bsonType: 'bool' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('subscriptionPlans', subscriptionPlansValidator)
ensureIndex('subscriptionPlans', { name: 1 }, { unique: true, name: 'uniq_subscriptionplan_name' })
ensureIndex('subscriptionPlans', { slug: 1 }, { unique: true, name: 'uniq_subscriptionplan_slug' })

/* =========================
   tenantSubscriptions
   Live billing state per organisation (trial / active / renewals).
   Payment provider fields are placeholders until payments ship.
   ========================= */
const tenantSubscriptionsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'tenantId',
      'planId',
      'status',
      'billingInterval',
      'renewalMode',
      'currentPeriodStart',
      'currentPeriodEnd',
      'billingContactUserId',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      tenantId: { bsonType: 'objectId' },
      planId: { bsonType: 'objectId' },
      status: { enum: ['trialing', 'active', 'past_due', 'canceled', 'expired', 'incomplete'] },
      billingInterval: { enum: ['monthly', 'yearly'] },
      renewalMode: { enum: ['auto', 'manual'] },
      trialStartsAt: { bsonType: ['date', 'null'] },
      trialEndsAt: { bsonType: ['date', 'null'] },
      currentPeriodStart: { bsonType: 'date' },
      currentPeriodEnd: { bsonType: 'date' },
      cancelAtPeriodEnd: { bsonType: 'bool' },
      canceledAt: { bsonType: ['date', 'null'] },
      pendingPlanId: { bsonType: ['objectId', 'null'] },
      pendingBillingInterval: { bsonType: ['string', 'null'] },
      pendingChangeEffectiveAt: { bsonType: ['date', 'null'] },
      pendingChangeKind: { bsonType: ['string', 'null'] },
      entitlementsSnapshot: { bsonType: ['object', 'null'] },
      entitlementsVersion: { bsonType: ['int', 'null'] },
      billingContactUserId: { bsonType: 'objectId' },
      billingContactNominatedBy: { bsonType: ['objectId', 'null'] },
      discountCodeId: { bsonType: ['objectId', 'null'] },
      discountSnapshot: { bsonType: ['object', 'null'] },
      paymentProvider: { bsonType: ['string', 'null'] },
      externalCustomerId: { bsonType: ['string', 'null'] },
      externalSubscriptionId: { bsonType: ['string', 'null'] },
      externalPlanId: { bsonType: ['string', 'null'] },
      externalSubscriptionStatus: { bsonType: ['string', 'null'] },
      defaultPaymentMethodLabel: { bsonType: ['string', 'null'] },
      lastPaymentStatus: { enum: ['none', 'pending', 'succeeded', 'failed'] },
      lastPaymentMethod: { bsonType: ['string', 'null'] },
      lastPaymentNote: { bsonType: ['string', 'null'] },
      lastPaymentAt: { bsonType: ['date', 'null'] },
      lastPaymentRecordedBy: { bsonType: ['objectId', 'null'] },
      reminderDaysBeforeDue: { bsonType: 'array' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('tenantSubscriptions', tenantSubscriptionsValidator)
ensureIndex('tenantSubscriptions', { tenantId: 1, status: 1 }, { name: 'idx_tenantSubscriptions_tenant_status' })
ensureIndex('tenantSubscriptions', { planId: 1 }, { name: 'idx_tenantSubscriptions_plan' })
ensureIndex('tenantSubscriptions', { currentPeriodEnd: 1 }, { name: 'idx_tenantSubscriptions_period_end' })
ensureIndex('tenantSubscriptions', { externalSubscriptionId: 1 }, { name: 'idx_tenantSubscriptions_ext_sub', sparse: true })

/* =========================
   billingCustomers
   Provider customer mapping (Razorpay cust_… per tenant).
   ========================= */
const billingCustomersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'provider', 'createdAt', 'updatedAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      provider: { enum: ['stripe', 'razorpay', 'manual'] },
      externalCustomerId: { bsonType: ['string', 'null'] },
      email: { bsonType: ['string', 'null'] },
      contact: { bsonType: ['string', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('billingCustomers', billingCustomersValidator)
ensureIndex('billingCustomers', { tenantId: 1 }, { unique: true, name: 'uniq_billingCustomers_tenant' })
ensureIndex(
  'billingCustomers',
  { provider: 1, externalCustomerId: 1 },
  { name: 'idx_billingCustomers_provider_ext', sparse: true }
)

/* =========================
   invoiceCounters
   Atomic fiscal-year invoice number sequences.
   ========================= */
const invoiceCountersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['fiscalYear', 'prefix', 'seq'],
    properties: {
      fiscalYear: { bsonType: 'string' },
      prefix: { bsonType: 'string' },
      seq: { bsonType: ['int', 'long', 'double'] }
    },
    additionalProperties: true
  }
}

ensureCollection('invoiceCounters', invoiceCountersValidator)
ensureIndex('invoiceCounters', { fiscalYear: 1, prefix: 1 }, { unique: true, name: 'uniq_invoiceCounters_fy_prefix' })

/* =========================
   invoices
   GST tax invoices (immutable once paid/void).
   ========================= */
const invoicesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'tenantId',
      'invoiceNumber',
      'fiscalYear',
      'status',
      'currency',
      'subtotalPaise',
      'taxablePaise',
      'totalPaise',
      'taxType',
      'sellerSnapshot',
      'buyerSnapshot',
      'lineItems',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      tenantId: { bsonType: 'objectId' },
      subscriptionId: { bsonType: ['objectId', 'null'] },
      invoiceNumber: { bsonType: 'string' },
      fiscalYear: { bsonType: 'string' },
      status: { enum: ['draft', 'open', 'paid', 'void', 'uncollectible'] },
      currency: { bsonType: 'string' },
      subtotalPaise: { bsonType: ['long', 'int', 'double'] },
      discountPaise: { bsonType: ['long', 'int', 'double'] },
      taxablePaise: { bsonType: ['long', 'int', 'double'] },
      cgstPaise: { bsonType: ['long', 'int', 'double'] },
      sgstPaise: { bsonType: ['long', 'int', 'double'] },
      igstPaise: { bsonType: ['long', 'int', 'double'] },
      totalPaise: { bsonType: ['long', 'int', 'double'] },
      taxRateBps: { bsonType: ['int', 'long', 'double'] },
      taxType: { enum: ['intra', 'inter'] },
      sellerSnapshot: { bsonType: 'object' },
      buyerSnapshot: { bsonType: 'object' },
      lineItems: { bsonType: 'array' },
      discountSnapshot: { bsonType: ['object', 'null'] },
      issuedAt: { bsonType: ['date', 'null'] },
      dueAt: { bsonType: ['date', 'null'] },
      paidAt: { bsonType: ['date', 'null'] },
      voidedAt: { bsonType: ['date', 'null'] },
      pdfUrl: { bsonType: ['string', 'null'] },
      pdfStorageKey: { bsonType: ['string', 'null'] },
      emailStatus: { enum: ['pending', 'sent', 'failed', 'skipped'] },
      emailSentAt: { bsonType: ['date', 'null'] },
      emailError: { bsonType: ['string', 'null'] },
      provider: { enum: ['stripe', 'razorpay', 'manual'] },
      externalPaymentId: { bsonType: ['string', 'null'] },
      externalOrderId: { bsonType: ['string', 'null'] },
      irn: { bsonType: ['string', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('invoices', invoicesValidator)
ensureIndex('invoices', { invoiceNumber: 1 }, { unique: true, name: 'uniq_invoices_number' })
ensureIndex('invoices', { tenantId: 1, issuedAt: -1 }, { name: 'idx_invoices_tenant_issued' })
ensureIndex('invoices', { tenantId: 1, status: 1 }, { name: 'idx_invoices_tenant_status' })
ensureIndex('invoices', { externalPaymentId: 1 }, { name: 'idx_invoices_ext_payment', sparse: true })

/* =========================
   payments
   Money movement ledger (Razorpay + manual).
   ========================= */
const paymentsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'provider', 'amountPaise', 'currency', 'status', 'createdAt', 'updatedAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      subscriptionId: { bsonType: ['objectId', 'null'] },
      invoiceId: { bsonType: ['objectId', 'null'] },
      provider: { enum: ['stripe', 'razorpay', 'manual'] },
      externalPaymentId: { bsonType: ['string', 'null'] },
      externalOrderId: { bsonType: ['string', 'null'] },
      externalInvoiceId: { bsonType: ['string', 'null'] },
      amountPaise: { bsonType: ['long', 'int', 'double'] },
      currency: { bsonType: 'string' },
      status: {
        enum: ['created', 'authorized', 'captured', 'failed', 'refunded', 'partial_refund']
      },
      method: { bsonType: ['string', 'null'] },
      failureCode: { bsonType: ['string', 'null'] },
      failureMessage: { bsonType: ['string', 'null'] },
      recordedBy: { bsonType: ['objectId', 'null'] },
      note: { bsonType: ['string', 'null'] },
      rawProviderPayload: { bsonType: ['object', 'null'] },
      paidAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('payments', paymentsValidator)
ensureIndex(
  'payments',
  { externalPaymentId: 1 },
  { unique: true, sparse: true, name: 'uniq_payments_ext_payment' }
)
ensureIndex('payments', { invoiceId: 1 }, { name: 'idx_payments_invoice' })
ensureIndex('payments', { tenantId: 1, createdAt: -1 }, { name: 'idx_payments_tenant_created' })
ensureIndex('payments', { externalOrderId: 1 }, { name: 'idx_payments_ext_order', sparse: true })

/* =========================
   webhookEvents
   Idempotent provider webhook intake.
   ========================= */
const webhookEventsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['provider', 'eventId', 'eventType', 'status', 'createdAt'],
    properties: {
      provider: { enum: ['stripe', 'razorpay'] },
      eventId: { bsonType: 'string' },
      eventType: { bsonType: 'string' },
      payload: { bsonType: 'object' },
      status: { enum: ['received', 'processed', 'ignored', 'failed'] },
      errorMessage: { bsonType: ['string', 'null'] },
      processedAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('webhookEvents', webhookEventsValidator)
ensureIndex('webhookEvents', { eventId: 1 }, { unique: true, name: 'uniq_webhookEvents_eventId' })
ensureIndex('webhookEvents', { provider: 1, createdAt: -1 }, { name: 'idx_webhookEvents_provider_created' })

/* =========================
   discountCodes
   Super-admin promo codes: global, plan-scoped, or tenant-scoped.
   ========================= */
const discountCodesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['code', 'name', 'type', 'value', 'scope', 'validFrom', 'validTo', 'isActive', 'createdBy', 'createdAt', 'updatedAt'],
    properties: {
      code: { bsonType: 'string' },
      name: { bsonType: 'string' },
      description: { bsonType: 'string' },
      type: { enum: ['percent', 'fixed'] },
      value: { bsonType: ['double', 'int'] },
      currency: { bsonType: ['string', 'null'] },
      scope: { enum: ['global', 'plan', 'tenant'] },
      planIds: { bsonType: 'array' },
      tenantIds: { bsonType: 'array' },
      validFrom: { bsonType: 'date' },
      validTo: { bsonType: 'date' },
      maxRedemptions: { bsonType: ['int', 'null'] },
      redemptionCount: { bsonType: 'int' },
      duration: { enum: ['once', 'repeating', 'forever'] },
      durationMonths: { bsonType: ['int', 'null'] },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: 'objectId' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('discountCodes', discountCodesValidator)
ensureIndex('discountCodes', { code: 1 }, { unique: true, name: 'uniq_discount_code' })
ensureIndex('discountCodes', { isActive: 1, validTo: 1 }, { name: 'idx_discount_active_validity' })

const customersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'fullName', 'mobile', 'employmentType', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      fullName: { bsonType: 'string', minLength: 2 },
      countryCode: { bsonType: 'string' },
      mobile: { bsonType: 'string', pattern: '^[0-9]{8,10}$' },
      isNRI: { bsonType: 'bool' },
      email: { bsonType: ['string', 'null'], pattern: '^.+@.+\\..+$' },
      dob: { bsonType: ['date', 'null'] },
      pan: { bsonType: ['string', 'null'], pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' },
      aadhaarMasked: { bsonType: ['string', 'null'] },
      address: { bsonType: ['string', 'null'] },
      remarks: { bsonType: ['string', 'null'], maxLength: 500 },
      secondaryContacts: {
        bsonType: ['array', 'null'],
        maxItems: 3,
        items: {
          bsonType: 'object',
          required: ['countryCode', 'mobile', 'type'],
          properties: {
            countryCode: { bsonType: 'string', pattern: '^\\+[0-9]{1,3}$' },
            mobile: { bsonType: 'string', pattern: '^[0-9]{8,10}$' },
            type: { enum: ['ALTERNATE', 'SPOUSE', 'FRIEND', 'RELATIVE', 'OTHER'] }
          },
          additionalProperties: true
        }
      },
      employmentType: { enum: ['SALARIED', 'SELF_EMPLOYED'] },
      monthlyIncome: { bsonType: ['number', 'null'], minimum: 0 },
      cibilScore: { bsonType: ['int', 'null'], minimum: 300, maximum: 900 },
      source: { enum: ['WALK_IN', 'REFERRAL', 'ONLINE', 'SOCIAL_MEDIA', 'OTHER'] },
      code: { bsonType: 'string', minLength: 3 },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('customers', customersValidator)
dropUniqueIndexesOnFields('customers', ['fullName'])
ensureIndex('customers', { tenantId: 1 }, { name: 'idx_tenantId' })
ensureIndex('customers', { tenantId: 1, mobile: 1 }, { unique: true, name: 'uniq_tenant_mobile' })
ensureIndex(
  'customers',
  { tenantId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } }, name: 'uniq_tenant_customer_code' }
)

const associatesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'associateName', 'companyName', 'associateTypeId', 'mobile', 'code', 'isActive', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      associateName: { bsonType: 'string', minLength: 2 },
      companyName: { bsonType: 'string', minLength: 2 },
      associateTypeId: { bsonType: 'objectId' },
      countryCode: { bsonType: 'string' },
      mobile: { bsonType: 'string', pattern: '^[0-9]{8,10}$' },
      email: { bsonType: ['string', 'null'], pattern: '^.+@.+\\..+$' },
      payout: { bsonType: ['number', 'null'], minimum: 0, maximum: 100 },
      code: { bsonType: 'string', minLength: 3 },
      pan: { bsonType: ['string', 'null'], pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' },
      remarks: { bsonType: ['string', 'null'], maxLength: 500 },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('associates', associatesValidator)
ensureIndex('associates', { tenantId: 1 }, { name: 'idx_associates_tenantId' })
ensureIndex('associates', { tenantId: 1, mobile: 1 }, { unique: true, name: 'uniq_tenant_associate_mobile' })
ensureIndex('associates', { tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_associate_code' })
ensureIndex('associates', { tenantId: 1, associateTypeId: 1 }, { name: 'idx_associates_tenant_associateTypeId' })

const advocatesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'name', 'mobile', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      name: { bsonType: 'string', minLength: 2 },
      countryCode: { bsonType: 'string' },
      mobile: { bsonType: 'string', pattern: '^[0-9]{8,10}$' },
      email: { bsonType: ['string', 'null'], pattern: '^.+@.+\\..+$' },
      address: { bsonType: ['string', 'null'] },
      code: { bsonType: 'string', minLength: 3 },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('advocates', advocatesValidator)
ensureIndex('advocates', { tenantId: 1 }, { name: 'idx_advocates_tenantId' })
ensureIndex('advocates', { tenantId: 1, mobile: 1 }, { unique: true, name: 'uniq_tenant_advocate_mobile' })
ensureIndex(
  'advocates',
  { tenantId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } }, name: 'uniq_tenant_advocate_code' }
)

const banksValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'code', 'name', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      code: { bsonType: 'string', minLength: 1 },
      codeNormalized: { bsonType: 'string' },
      name: { bsonType: 'string', minLength: 2 },
      description: { bsonType: ['string', 'null'] },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('banks', banksValidator)
ensureIndex('banks', { tenantId: 1 }, { name: 'idx_banks_tenantId' })
ensureIndex('banks', { tenantId: 1, codeNormalized: 1 }, { unique: true, name: 'uniq_tenant_bank_code' })

const loanTypesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'code', 'name', 'isActive', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      code: { bsonType: 'string', minLength: 2 },
      name: { bsonType: 'string', minLength: 2 },
      description: { bsonType: ['string', 'null'] },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('loanTypes', loanTypesValidator)
ensureIndex('loanTypes', { tenantId: 1 }, { name: 'idx_loanTypes_tenantId' })
ensureIndex('loanTypes', { tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_loanType_code' })

const documentChecklistsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'name', 'isActive', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      name: { bsonType: 'string', minLength: 2 },
      description: { bsonType: ['string', 'null'] },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('documentChecklists', documentChecklistsValidator)
ensureIndex('documentChecklists', { tenantId: 1 }, { name: 'idx_documentChecklists_tenantId' })
ensureIndex('documentChecklists', { tenantId: 1, name: 1 }, { unique: true, name: 'uniq_tenant_documentChecklist_name' })

const associateTypesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'name', 'isActive', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      name: { bsonType: 'string', minLength: 2 },
      description: { bsonType: ['string', 'null'] },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('associateTypes', associateTypesValidator)
ensureIndex('associateTypes', { tenantId: 1 }, { name: 'idx_associateTypes_tenantId' })
ensureIndex('associateTypes', { tenantId: 1, name: 1 }, { unique: true, name: 'uniq_tenant_associateType_name' })

const corporatesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'code', 'codeNormalized', 'name', 'isActive', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      code: { bsonType: 'string', minLength: 1 },
      codeNormalized: { bsonType: 'string', minLength: 1 },
      name: { bsonType: 'string', minLength: 2 },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('corporates', corporatesValidator)
ensureIndex('corporates', { tenantId: 1 }, { name: 'idx_corporates_tenantId' })
ensureIndex('corporates', { tenantId: 1, codeNormalized: 1 }, { unique: true, name: 'uniq_tenant_corporate_code' })

const loanStatusPipelineStagesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'name', 'order', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      name: { bsonType: 'string', minLength: 2 },
      description: { bsonType: ['string', 'null'] },
      order: { bsonType: 'number', minimum: 1, multipleOf: 1 },
      isLoggedIn: { bsonType: 'bool' },
      isDisbursed: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('loanStatusPipelineStages', loanStatusPipelineStagesValidator)
ensureIndex('loanStatusPipelineStages', { tenantId: 1 }, { name: 'idx_loanStatusPipelineStages_tenantId' })
ensureIndex(
  'loanStatusPipelineStages',
  { tenantId: 1, name: 1 },
  { unique: true, name: 'uniq_tenant_loanStatusPipelineStage_name' }
)
ensureIndex('loanStatusPipelineStages', { tenantId: 1, order: 1 }, { name: 'idx_tenant_loanStatusPipelineStage_order' })

const loanTypeDocumentsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'loanTypeId', 'documentId', 'status', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      loanTypeId: { bsonType: 'objectId' },
      documentId: { bsonType: 'objectId' },
      status: { enum: ['REQUIRED', 'OPTIONAL', 'INACTIVE'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('loanTypeDocuments', loanTypeDocumentsValidator)
ensureIndex('loanTypeDocuments', { tenantId: 1 }, { name: 'idx_loanTypeDocuments_tenantId' })
ensureIndex(
  'loanTypeDocuments',
  { tenantId: 1, loanTypeId: 1, documentId: 1 },
  { unique: true, name: 'uniq_tenant_loanType_document' }
)

const loanCasesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'customerId', 'loanTypeId', 'stageId', 'documents', 'createdBy', 'createdAt', 'updatedAt', 'isLocked', 'isActive'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      customerId: { bsonType: 'objectId' },
      loanTypeId: { bsonType: 'objectId' },
      stageId: { bsonType: 'objectId' },
      bankName: { bsonType: ['string', 'null'] },
      bankId: { bsonType: ['objectId', 'null'] },
      bankCode: { bsonType: ['string', 'null'], maxLength: 32 },
      code: { bsonType: ['string', 'null'], maxLength: 64 },
      codePrevious: { bsonType: ['string', 'null'], maxLength: 64 },
      codeUpdatedAt: { bsonType: ['date', 'null'] },
      requestedAmount: { bsonType: ['number', 'null'], minimum: 0 },
      approvedAmount: { bsonType: ['number', 'null'], minimum: 0 },
      loanAccount: { bsonType: ['string', 'null'], maxLength: 20 },
      interestRate: { bsonType: ['number', 'null'], minimum: 0 },
      tenureMonths: { bsonType: ['number', 'null'], minimum: 0, multipleOf: 1 },
      emi: { bsonType: ['number', 'null'], minimum: 0 },
      assignedAgentId: { bsonType: ['objectId', 'null'] },
      leadSource: { enum: ['DIRECT', 'ASSOCIATE', 'ADVOCATE'] },
      associateId: { bsonType: ['objectId', 'null'] },
      advocateId: { bsonType: ['objectId', 'null'] },
      corporateId: { bsonType: ['objectId', 'null'] },
      documents: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['documentId', 'documentName', 'status'],
          properties: {
            documentId: { bsonType: 'objectId' },
            documentName: { bsonType: 'string' },
            status: { enum: ['COLLECTED', 'SUBMITTED_TO_BANK', 'APPROVED', 'PENDING'] }
          },
          additionalProperties: true
        }
      },
      remarks: {
        bsonType: ['array', 'null'],
        items: {
          bsonType: 'object',
          required: ['text', 'updatedAt'],
          properties: {
            text: { bsonType: 'string', minLength: 1, maxLength: 1000 },
            updatedByUserId: { bsonType: ['objectId', 'string', 'null'] },
            updatedByName: { bsonType: ['string', 'null'] },
            updatedByEmail: { bsonType: ['string', 'null'] },
            updatedAt: { bsonType: ['date', 'null'] }
          },
          additionalProperties: true
        }
      },
      createdBy: { bsonType: 'objectId' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
      isLocked: { bsonType: 'bool' },
      isActive: { bsonType: 'bool' },
      enableProgressivePayment: { bsonType: 'bool' }
    },
    additionalProperties: true
  }
}

ensureCollection('loanCases', loanCasesValidator)
dropUniqueIndexesOnFields('loanCases', ['customerId', 'loanTypeId', 'requestedAmount'])
ensureIndex('loanCases', { tenantId: 1 }, { name: 'idx_loanCases_tenantId' })
ensureIndex('loanCases', { tenantId: 1, updatedAt: -1 }, { name: 'idx_loanCases_tenantId_updatedAt' })
ensureIndex('loanCases', { tenantId: 1, customerId: 1 }, { name: 'idx_loanCases_tenantId_customerId' })
ensureIndex('loanCases', { tenantId: 1, loanTypeId: 1 }, { name: 'idx_loanCases_tenantId_loanTypeId' })
ensureIndex('loanCases', { tenantId: 1, stageId: 1 }, { name: 'idx_loanCases_tenantId_stageId' })
ensureIndex('loanCases', { tenantId: 1, createdBy: 1 }, { name: 'idx_loanCases_tenantId_createdBy' })
ensureIndex('loanCases', { tenantId: 1, assignedAgentId: 1 }, { name: 'idx_loanCases_tenantId_assignedAgentId' })
ensureIndex(
  'loanCases',
  { tenantId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } }, name: 'uniq_loanCases_tenantId_code' }
)

/* =========================
   codeGenerationConfigs
   Tenant-scoped business code templates per entity type.
   ========================= */
const codeGenerationConfigsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'entityType', 'isEnabled', 'template', 'prefix', 'sequencePadLength', 'updatedAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      entityType: {
        enum: ['LEAD', 'CUSTOMER', 'BANK', 'ASSOCIATE', 'CORPORATE', 'LOAN_TYPE', 'ADVOCATE']
      },
      isEnabled: { bsonType: 'bool' },
      template: { bsonType: 'string', maxLength: 80 },
      prefix: { bsonType: 'string', minLength: 1, maxLength: 8 },
      sequencePadLength: { bsonType: 'number', minimum: 1, maximum: 8 },
      updatedBy: { bsonType: ['objectId', 'null'] },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('codeGenerationConfigs', codeGenerationConfigsValidator)
ensureIndex(
  'codeGenerationConfigs',
  { tenantId: 1, entityType: 1 },
  { unique: true, name: 'uniq_codeGenerationConfigs_tenant_entity' }
)

/* =========================
   codeSequences
   Atomic counters for business code SEQ tokens.
   ========================= */
const codeSequencesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'entityType', 'scopeKey', 'nextValue'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      entityType: {
        enum: ['LEAD', 'CUSTOMER', 'BANK', 'ASSOCIATE', 'CORPORATE', 'LOAN_TYPE', 'ADVOCATE']
      },
      scopeKey: { bsonType: 'string' },
      nextValue: { bsonType: 'number', minimum: 0 },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('codeSequences', codeSequencesValidator)
ensureIndex(
  'codeSequences',
  { tenantId: 1, entityType: 1, scopeKey: 1 },
  { unique: true, name: 'uniq_codeSequences_tenant_entity_scope' }
)

/* =========================
   appointments
   Scheduling and follow-up chain support.
   ========================= */
const appointmentsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'leadId', 'customerId', 'scheduledAt', 'followUpType', 'status', 'createdBy', 'createdAt', 'updatedAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      leadId: { bsonType: 'objectId' },
      customerId: { bsonType: 'objectId' },
      caseId: { bsonType: ['objectId', 'null'] },
      scheduledAt: { bsonType: 'date' },
      durationMinutes: { bsonType: ['number', 'null'], minimum: 1 },
      followUpType: { enum: ['CALL', 'WHATSAPP', 'VISIT', 'EMAIL'] },
      status: { enum: ['SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'] },
      outcomeComments: { bsonType: ['string', 'null'] },
      assignedTo: { bsonType: ['objectId', 'null'] },
      createdBy: { bsonType: 'objectId' },
      parentAppointmentId: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('appointments', appointmentsValidator)

// Indexes
ensureIndex('appointments', { tenantId: 1 }, { name: 'idx_appointments_tenantId' })
ensureIndex('appointments', { leadId: 1 }, { name: 'idx_appointments_leadId' })
ensureIndex('appointments', { customerId: 1 }, { name: 'idx_appointments_customerId' })
ensureIndex('appointments', { scheduledAt: 1 }, { name: 'idx_appointments_scheduledAt' })
ensureIndex('appointments', { assignedTo: 1 }, { name: 'idx_appointments_assignedTo' })
ensureIndex('appointments', { parentAppointmentId: 1 }, { name: 'idx_appointments_parentAppointmentId' })

/* =========================
   progressive loan disbursements
   One tracker per lead; line items in loanDisbursements.
   ========================= */
const loanDisbursementTrackersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'tenantId',
      'leadId',
      'approvedAmount',
      'totalDisbursedAmount',
      'remainingAmount',
      'disbursementStatus',
      'createdByUserId',
      'createdByName',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      tenantId: { bsonType: 'objectId' },
      leadId: { bsonType: 'objectId' },
      approvedAmount: { bsonType: 'number', minimum: 0 },
      totalDisbursedAmount: { bsonType: 'number', minimum: 0 },
      remainingAmount: { bsonType: 'number', minimum: 0 },
      disbursementStatus: { enum: ['PENDING', 'PARTIAL', 'COMPLETED'] },
      createdByUserId: { bsonType: 'objectId' },
      createdByName: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('loanDisbursementTrackers', loanDisbursementTrackersValidator)
ensureIndex('loanDisbursementTrackers', { tenantId: 1 }, { name: 'idx_loanDisbursementTrackers_tenantId' })
ensureIndex(
  'loanDisbursementTrackers',
  { tenantId: 1, leadId: 1 },
  { unique: true, name: 'uniq_tenant_lead_disbursement_tracker' }
)
ensureIndex(
  'loanDisbursementTrackers',
  { tenantId: 1, disbursementStatus: 1, updatedAt: -1 },
  { name: 'idx_loanDisbursementTrackers_tenant_status_updated' }
)

const loanDisbursementsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'tenantId',
      'trackerId',
      'leadId',
      'amount',
      'disbursedDate',
      'reason',
      'createdByUserId',
      'createdByName',
      'createdAt'
    ],
    properties: {
      tenantId: { bsonType: 'objectId' },
      trackerId: { bsonType: 'objectId' },
      leadId: { bsonType: 'objectId' },
      amount: { bsonType: 'number', exclusiveMinimum: 0 },
      disbursedDate: { bsonType: 'date' },
      reason: { bsonType: 'string', minLength: 1 },
      bankReference: { bsonType: ['string', 'null'] },
      createdByUserId: { bsonType: 'objectId' },
      createdByName: { bsonType: 'string' },
      createdAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('loanDisbursements', loanDisbursementsValidator)
ensureIndex('loanDisbursements', { tenantId: 1 }, { name: 'idx_loanDisbursements_tenantId' })
ensureIndex('loanDisbursements', { trackerId: 1, disbursedDate: -1 }, { name: 'idx_loanDisbursements_tracker_date' })
ensureIndex('loanDisbursements', { leadId: 1 }, { name: 'idx_loanDisbursements_leadId' })

/* =========================
   Referral program
   Platform-wide refer-a-DSA credits, invites, and withdrawals.
   ========================= */
const referralProgramSettingsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['_id', 'commissionPercent', 'headline', 'subheadline', 'benefits', 'termsHtml', 'ctaLabel', 'updatedAt'],
    properties: {
      _id: { bsonType: 'string' },
      commissionPercent: { bsonType: 'number', minimum: 0, maximum: 100 },
      headline: { bsonType: 'string' },
      subheadline: { bsonType: 'string' },
      benefits: {
        bsonType: 'array',
        items: { bsonType: 'string' }
      },
      termsHtml: { bsonType: 'string' },
      ctaLabel: { bsonType: 'string' },
      updatedAt: { bsonType: 'date' },
      updatedByUserId: { bsonType: ['objectId', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('referralProgramSettings', referralProgramSettingsValidator)

const referralInvitesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'referrerUserId',
      'inviteeEmail',
      'inviteeMobile',
      'token',
      'status',
      'commissionCancelled',
      'createdAt',
      'updatedAt'
    ],
    properties: {
      referrerUserId: { bsonType: 'objectId' },
      referrerTenantId: { bsonType: ['objectId', 'null'] },
      inviteeName: { bsonType: ['string', 'null'] },
      inviteeEmail: { bsonType: 'string' },
      inviteeMobile: { bsonType: 'string' },
      token: { bsonType: 'string' },
      status: { enum: ['invited', 'onboarded', 'subscribed', 'paid', 'cancelled'] },
      referredTenantId: { bsonType: ['objectId', 'null'] },
      onboardedAt: { bsonType: ['date', 'null'] },
      subscribedAt: { bsonType: ['date', 'null'] },
      lastCreditedAt: { bsonType: ['date', 'null'] },
      commissionPercentOverride: { bsonType: ['number', 'null'], minimum: 0, maximum: 100 },
      commissionCancelled: { bsonType: 'bool' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('referralInvites', referralInvitesValidator)
ensureIndex('referralInvites', { token: 1 }, { unique: true, name: 'uniq_referralInvites_token' })
ensureIndex('referralInvites', { referrerUserId: 1, status: 1 }, { name: 'idx_referralInvites_referrer_status' })
ensureIndex(
  'referralInvites',
  { referredTenantId: 1 },
  {
    unique: true,
    sparse: true,
    name: 'uniq_referralInvites_referredTenantId',
    partialFilterExpression: { referredTenantId: { $type: 'objectId' } }
  }
)
ensureIndex('referralInvites', { inviteeEmail: 1 }, { name: 'idx_referralInvites_email' })
ensureIndex('referralInvites', { inviteeMobile: 1 }, { name: 'idx_referralInvites_mobile' })
ensureIndex('referralInvites', { createdAt: -1 }, { name: 'idx_referralInvites_createdAt' })

const referralCreditsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'referralInviteId',
      'referrerUserId',
      'referredTenantId',
      'subscriptionAmount',
      'commissionPercent',
      'commissionAmount',
      'status',
      'createdAt',
      'createdByUserId'
    ],
    properties: {
      referralInviteId: { bsonType: 'objectId' },
      referrerUserId: { bsonType: 'objectId' },
      referredTenantId: { bsonType: 'objectId' },
      sourceInvoiceId: { bsonType: ['objectId', 'null'] },
      sourcePaymentNote: { bsonType: ['string', 'null'] },
      subscriptionAmount: { bsonType: 'number', minimum: 0 },
      commissionPercent: { bsonType: 'number', minimum: 0, maximum: 100 },
      commissionAmount: { bsonType: 'number', minimum: 0 },
      status: { enum: ['available', 'locked', 'withdrawn', 'void'] },
      withdrawalId: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      createdByUserId: { bsonType: 'objectId' }
    },
    additionalProperties: true
  }
}

ensureCollection('referralCredits', referralCreditsValidator)
ensureIndex('referralCredits', { referrerUserId: 1, status: 1 }, { name: 'idx_referralCredits_referrer_status' })
ensureIndex('referralCredits', { referralInviteId: 1 }, { name: 'idx_referralCredits_invite' })
ensureIndex('referralCredits', { referredTenantId: 1, createdAt: -1 }, { name: 'idx_referralCredits_tenant' })
ensureIndex('referralCredits', { withdrawalId: 1 }, { name: 'idx_referralCredits_withdrawal' })

const referralWithdrawalsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['referrerUserId', 'creditIds', 'amount', 'payoutDetails', 'status', 'requestedAt'],
    properties: {
      referrerUserId: { bsonType: 'objectId' },
      creditIds: {
        bsonType: 'array',
        items: { bsonType: 'objectId' }
      },
      amount: { bsonType: 'number', minimum: 0 },
      payoutDetails: {
        bsonType: 'object',
        required: ['method'],
        properties: {
          method: { enum: ['upi', 'bank'] },
          upiId: { bsonType: ['string', 'null'] },
          accountName: { bsonType: ['string', 'null'] },
          accountNumber: { bsonType: ['string', 'null'] },
          ifsc: { bsonType: ['string', 'null'] }
        },
        additionalProperties: true
      },
      status: { enum: ['requested', 'paid', 'rejected'] },
      note: { bsonType: ['string', 'null'] },
      requestedAt: { bsonType: 'date' },
      resolvedAt: { bsonType: ['date', 'null'] },
      resolvedByUserId: { bsonType: ['objectId', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('referralWithdrawals', referralWithdrawalsValidator)
ensureIndex('referralWithdrawals', { referrerUserId: 1, status: 1 }, { name: 'idx_referralWithdrawals_referrer_status' })
ensureIndex('referralWithdrawals', { status: 1, requestedAt: -1 }, { name: 'idx_referralWithdrawals_status' })

print('Database initialization complete.')

if (typeof module !== 'undefined' && module.exports) {
  const mongoose = require('mongoose')

  const SubscriptionPlanSchema = new mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
      description: { type: String, required: true, trim: true },
      priceMonthly: { type: Number, required: true, min: 0 },
      priceYearly: { type: Number, min: 0 },
      currency: { type: String, default: 'INR' },
      maxUsers: { type: Number, required: true, min: 1 },
      features: { type: Map, of: Boolean, default: {} },
      isActive: { type: Boolean, default: true },
      isDefault: { type: Boolean, default: false }
    },
    { timestamps: true }
  )

  SubscriptionPlanSchema.index({ name: 1 }, { unique: true })
  SubscriptionPlanSchema.index({ slug: 1 }, { unique: true })
  SubscriptionPlanSchema.pre('save', function (next) {
    if (typeof this.name === 'string') this.name = this.name.trim()
    if (typeof this.slug === 'string') this.slug = this.slug.toLowerCase().trim()
    next()
  })

  const SubscriptionPlan =
    mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', SubscriptionPlanSchema)

  module.exports.SubscriptionPlan = SubscriptionPlan
}
