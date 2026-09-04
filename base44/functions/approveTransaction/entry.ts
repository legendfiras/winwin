import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireAdminSession, pointsForPurchaseUsd, creditPoints,
  activateMembershipRecord, nowIso, enrichCustomer, getLedgerByKey,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const admin = await requireAdminSession(database, body.admin_session_token);
    if (admin.error) return admin.error;

    const txId = body.transaction_id;
    if (!txId) return json({ error: 'Missing transaction_id' }, 400);
    let tx = await database.entities.StoreTransaction.get(txId);
    if (!tx) return json({ error: 'Transaction not found' }, 404);

    if (tx.status === 'REJECTED') {
      return json({ error: 'Rejected transactions cannot be approved. Create a new pending transaction.' }, 409);
    }

    const purchaseKey = `PURCHASE_REWARD:${tx.id}`;
    const loyaltyKey = `LOYALTY_CARD_BONUS:${tx.id}`;

    if (tx.status === 'APPROVED') {
      const customer = await database.entities.Customer.get(tx.customer_id);
      return json({
        success: true,
        already_approved: true,
        transaction: tx,
        customer: await enrichCustomer(database, customer),
      });
    }

    tx = await database.entities.StoreTransaction.update(tx.id, { status: 'PROCESSING' });

    const customer = await database.entities.Customer.get(tx.customer_id);
    if (!customer) return json({ error: 'Customer not found' }, 404);

    if (tx.type === 'PRODUCT_PURCHASE') {
      const existing = await getLedgerByKey(database, purchaseKey);
      if (!existing) {
        const points = pointsForPurchaseUsd(tx.amount_usd);
        await creditPoints(database, {
          customer,
          amount: points,
          type: 'PURCHASE_REWARD',
          reason: `Approved product purchase of $${Number(tx.amount_usd || 0).toFixed(2)}`,
          source: 'PRODUCT_PURCHASE',
          idempotency_key: purchaseKey,
          related_transaction_id: tx.id,
          created_by_admin_id: admin.session.id,
        });
        tx = await database.entities.StoreTransaction.update(tx.id, {
          status: 'APPROVED',
          calculated_points: points,
          reviewed_by: admin.session.id,
          reviewed_at: nowIso(),
        });
      } else {
        tx = await database.entities.StoreTransaction.update(tx.id, {
          status: 'APPROVED',
          reviewed_by: tx.reviewed_by || admin.session.id,
          reviewed_at: tx.reviewed_at || nowIso(),
        });
      }
    } else if (tx.type === 'LOYALTY_CARD') {
      const existing = await getLedgerByKey(database, loyaltyKey);
      if (!existing) {
        await activateMembershipRecord(database, {
          customer,
          source: 'PURCHASE_APPROVAL',
          approved_by: admin.session.id,
          related_transaction_id: tx.id,
          awardBonus: true,
        });
      }
      tx = await database.entities.StoreTransaction.update(tx.id, {
        status: 'APPROVED',
        calculated_points: 100,
        reviewed_by: admin.session.id,
        reviewed_at: nowIso(),
      });
    } else {
      return json({ error: 'Unknown transaction type' }, 400);
    }

    const updatedCustomer = await database.entities.Customer.get(tx.customer_id);
    return json({
      success: true,
      already_approved: false,
      transaction: tx,
      customer: await enrichCustomer(database, updatedCustomer),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
