import type { Shop } from '../types';

export function validateShop(shop: Shop): void {
  if (!shop.name.trim()) throw new Error('Enter the shop name.');
  const prices = shop.pricing;
  if (![prices.bwPerPage, prices.colorPerPage].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Black-and-white and color prices must be greater than zero.');
  }
  if (!Number.isFinite(prices.duplexRateRatio) || prices.duplexRateRatio <= 0 || prices.duplexRateRatio > 1) {
    throw new Error('The duplex price ratio must be greater than zero and no more than one.');
  }
  if (!prices.paperSizes.length || prices.paperSizes.some(paper => !Number.isFinite(paper.multiplier) || paper.multiplier <= 0)) {
    throw new Error('Each paper size needs a positive price multiplier.');
  }
  if (!Number.isFinite(shop.retentionMinutes) || shop.retentionMinutes < 1) throw new Error('Choose a valid file retention period.');
  if (shop.monthlySubscriptionFee !== undefined && (!Number.isFinite(shop.monthlySubscriptionFee) || shop.monthlySubscriptionFee < 0)) {
    throw new Error('The monthly shop fee cannot be negative.');
  }
}
