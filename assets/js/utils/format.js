import { storeConfig } from '../config.js';

export const formatCurrency = (value) => {
  const formatter = new Intl.NumberFormat(storeConfig.locale, {
    style: 'currency',
    currency: storeConfig.currency,
    maximumFractionDigits: 0,
  });
  return formatter.format(value);
};
