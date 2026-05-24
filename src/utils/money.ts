export const formatTHB = (amount: number): string =>
  new Intl.NumberFormat("th-TH").format(amount);
