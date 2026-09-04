import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  readBody, json, db, requireCustomerSession, creditPoints, pointsPriceFromUsd, enrichCustomer,
} from '../_shared/helpers.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const database = db(base44);
    const body = await readBody(req);
    const authz = await requireCustomerSession(database, body.session_token);
    if (authz.error) return authz.error;

    const productId = body.product_id;
    if (!productId) return json({ error: 'Missing product_id' }, 400);
    const product = await database.entities.Product.get(productId);
    if (!product || product.in_stock === false) {
      return json({ error: 'Product is not available' }, 400);
    }
    const cost = product.points_price > 0 ? product.points_price : pointsPriceFromUsd(product.price);
    if (cost <= 0) return json({ error: 'This product cannot be redeemed' }, 400);
    if ((authz.customer.points || 0) < cost) {
      return json({ error: 'Not enough points' }, 400);
    }

    const credited = await creditPoints(database, {
      customer: authz.customer,
      amount: -cost,
      type: 'PRODUCT_REDEMPTION',
      reason: `Redeemed ${product.name}`,
      source: 'PRODUCT_REDEMPTION',
      idempotency_key: `PRODUCT_REDEMPTION:${authz.customer.id}:${product.id}:${Date.now()}`,
      related_transaction_id: product.id,
    });

    return json({
      success: true,
      product,
      points_used: cost,
      customer: await enrichCustomer(database, credited.customer),
    });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
