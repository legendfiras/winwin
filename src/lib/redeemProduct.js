import { invokeCustomer, setCustomer as saveCustomer } from '@/lib/customerAuth';
import { whatsappUrl } from '@/lib/whatsapp';

export async function redeemProductRequest(product) {
  const data = await invokeCustomer('redeemProduct', { product_id: product.id });
  if (data?.error) {
    const error = new Error(data.error);
    error.data = data;
    throw error;
  }
  if (data?.customer) saveCustomer(data.customer);
  return data;
}

export function openRedeemWhatsApp({ product, customer, pointsUsed, remaining, whatsappNumber }) {
  if (!product || !customer) return;
  const ambassadorInfo = customer.ambassador_code ? `\nAmbassador Code: ${customer.ambassador_code}` : '';
  const waMsg = [
    'Redemption Alert!',
    '',
    `Customer: ${customer.full_name || ''}`,
    `Email: ${customer.email || ''}`,
    `Mobile: ${customer.mobile || ''}${ambassadorInfo}`,
    '',
    `Requested Item: ${product.name}`,
    `Points Used: ${pointsUsed ?? ''}`,
    `Remaining Points: ${remaining ?? customer.points ?? ''}`,
    '',
    'Please process this order!',
  ].join('\n');
  window.open(whatsappUrl(whatsappNumber, waMsg), '_blank');
}
