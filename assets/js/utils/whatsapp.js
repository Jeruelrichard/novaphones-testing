import { storeConfig } from '../config.js';
import { formatCurrency } from './format.js';

const sanitizeNumber = (value) => value.replace(/\D/g, '');

export const buildWhatsAppLink = ({
  items,
  total,
  // Backwards-compat with earlier callers.
  subtotal,
  source = 'Storefront',
}) => {
  const number = sanitizeNumber(storeConfig.whatsappNumber || '');
  const linkBase = (storeConfig.whatsappLinkBase || '').trim();
  const computedTotal = items.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const unit = typeof item.price === 'number' ? item.price : 0;
    const lineTotal = typeof item.lineTotal === 'number' ? item.lineTotal : unit * qty;
    return sum + lineTotal;
  }, 0);
  const finalTotal =
    typeof total === 'number'
      ? total
      : typeof subtotal === 'number'
        ? subtotal
        : computedTotal;

  const lines = items.map((item) => {
    const qty = Number(item.qty) || 1;
    const unit = typeof item.price === 'number' ? item.price : 0;
    const lineTotal = typeof item.lineTotal === 'number' ? item.lineTotal : unit * qty;
    const color = String(item.selectedColor || item.color || '').trim();
    const colorPart = color ? ` | Color: ${color}` : '';
    return `- ${item.name} x${qty}${colorPart} @ ${formatCurrency(unit)} = ${formatCurrency(lineTotal)}`;
  });
  const message = [
    `Hello ${storeConfig.name} team,`,
    `I want to order from ${source}:`,
    ...lines,
    `Total: ${formatCurrency(finalTotal)}`,
    'Please confirm availability and delivery details.',
  ].join('\n');

  if (number) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  if (linkBase) {
    const joiner = linkBase.includes('?') ? '&' : '?';
    return `${linkBase}${joiner}text=${encodeURIComponent(message)}`;
  }

  return '#';
};

export const buildSingleItemMessage = (product, qty, color = '') => {
  if (!product) return '';
  const total = product.price * qty;
  return buildWhatsAppLink({
    items: [{ ...product, qty, selectedColor: color, lineTotal: total }],
    total,
    source: product.name,
  });
};
