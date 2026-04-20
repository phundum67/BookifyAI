import { getCurrencyByCode } from "../data/currencies";

export function getBusinessCurrency(business = {}) {
  const option = getCurrencyByCode(business.currency_code || business.currency || "INR");
  return {
    code: business.currency_code || business.currency || option.code,
    symbol: business.currency_symbol || option.symbol,
  };
}

export function formatBusinessPrice(business = {}, suffix = "/ hour") {
  if (business.price_per_hour == null || business.price_per_hour === "") {
    return "Price on request";
  }

  const { symbol } = getBusinessCurrency(business);
  return `${symbol}${business.price_per_hour} ${suffix}`;
}

export function formatMoney(amount, currencyCode, currencySymbol) {
  const option = getCurrencyByCode(currencyCode || "INR");
  return `${currencySymbol || option.symbol}${amount || 0}`;
}
