const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const { resolveEntitlements, logBillingEvent, getCurrentPlan } = require('../services/billingEntitlements');
const { normalizePlanSlug, PLANS } = require('../config/plans');
const { createOrder, getOrderInfo } = require('../services/payriffService');
const { sendPaymentEmail } = require('../services/emailService');
const { enqueueNotification } = require('../services/notificationQueueService');

function planRank(p) {
  const s = normalizePlanSlug(p);
  if (s === 'business') return 3;
  if (s === 'pro') return 2;
  return 1;
}

function addDaysIso(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString();
}

function callbackUrlFromReq(req) {
  const env = String(process.env.PAYRIFF_CALLBACK_URL || '').trim();
