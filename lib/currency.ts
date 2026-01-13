/**
 * Formatta un numero come valuta in Euro con formato italiano
 * Usa il punto come separatore delle migliaia e la virgola per i decimali
 * Esempio: 1234.56 -> "1.234,56 €"
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Formatta un numero come valuta senza decimali
 * Esempio: 1234.56 -> "1.235 €"
 */
export const formatCurrencyNoDecimals = (value: number): string => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Formatta un numero con separatore delle migliaia italiano
 * Esempio: 1234.56 -> "1.234,56"
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};
