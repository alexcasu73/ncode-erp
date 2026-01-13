/**
 * Formatta un numero come valuta in Euro con formato italiano
 * Usa il punto come separatore delle migliaia e la virgola per i decimali
 * Esempio: 1234.56 -> "1.234,56 €"
 */
export const formatCurrency = (value: number): string => {
  // Arrotonda a 2 decimali
  const rounded = Math.round(value * 100) / 100;

  // Separa parte intera e decimale
  const [integerPart, decimalPart = '00'] = rounded.toFixed(2).split('.');

  // Aggiungi il punto per le migliaia
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Combina con la virgola per i decimali
  return `${formattedInteger},${decimalPart} €`;
};

/**
 * Formatta un numero come valuta senza decimali
 * Esempio: 1234.56 -> "1.235 €"
 */
export const formatCurrencyNoDecimals = (value: number): string => {
  // Arrotonda
  const rounded = Math.round(value);

  // Aggiungi il punto per le migliaia
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formatted} €`;
};

/**
 * Formatta un numero con separatore delle migliaia italiano
 * Esempio: 1234.56 -> "1.234,56"
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  // Arrotonda
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);

  // Separa parte intera e decimale
  const [integerPart, decimalPart = ''] = rounded.toFixed(decimals).split('.');

  // Aggiungi il punto per le migliaia
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Combina
  if (decimals === 0) {
    return formattedInteger;
  }

  return `${formattedInteger},${decimalPart}`;
};
