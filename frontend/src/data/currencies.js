export const currencyOptions = [
  { code: "INR", symbol: "₹", label: "INR (₹) - Indian Rupee" },
  { code: "USD", symbol: "$", label: "USD ($) - US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR (€) - Euro" },
  { code: "GBP", symbol: "£", label: "GBP (£) - British Pound" },
  { code: "AUD", symbol: "A$", label: "AUD (A$) - Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "CAD (C$) - Canadian Dollar" },
];

export function getCurrencyByCode(code) {
  return currencyOptions.find((currency) => currency.code === code) || currencyOptions[0];
}
