function seconds(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.ceil(number)) : 0;
}

export function timerRemainingAt(timer, now = Date.now()) {
  if (timer?.running && Number.isFinite(Number(timer.endsAt))) {
    return Math.max(0, Math.ceil((Number(timer.endsAt) - now) / 1000));
  }
  return seconds(timer?.remaining);
}

export function crossedCountdownWarning(previous, remaining, threshold = 10) {
  return previous > threshold && remaining <= threshold && remaining > 0;
}

export function adjustTimerBy(timer, deltaSeconds, now = Date.now()) {
  const previous = timerRemainingAt(timer, now);
  const delta = Number.isFinite(Number(deltaSeconds)) ? Math.trunc(Number(deltaSeconds)) : 0;
  const remaining = Math.max(0, previous + delta);
  const adjusted = { ...timer, remaining };

  if (timer?.running) adjusted.endsAt = now + remaining * 1000;
  else delete adjusted.endsAt;

  return {
    timer: adjusted,
    previous,
    remaining,
    crossedWarning: crossedCountdownWarning(previous, remaining),
    completed: Boolean(timer?.running && previous > 0 && remaining === 0)
  };
}
