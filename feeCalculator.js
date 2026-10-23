function calculateFee({ entryTime, exitTime, rate }) {
  const ms = new Date(exitTime) - new Date(entryTime);
  if (ms < 0) throw new Error('exitTime before entryTime');

  const minutes = Math.ceil(ms / 60000);
  if (minutes <= rate.grace_minutes) return 0;

  const MIN_PER_DAY = 24 * 60;
  const fullDays = Math.floor(minutes / MIN_PER_DAY);
  const remainderMinutes = minutes - fullDays * MIN_PER_DAY;
  const remainderHours = Math.ceil(remainderMinutes / 60);

  const remainderFee = Math.min(remainderHours * rate.hourly_rate_cents, rate.daily_cap_cents);
  return fullDays * rate.daily_cap_cents + remainderFee;
}

module.exports = { calculateFee };
