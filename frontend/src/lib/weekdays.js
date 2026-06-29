export function getWeekdays(t) {
  return [1, 2, 3, 4, 5, 6, 7].map((v) => ({
    v,
    short: t(`schedule.weekdays.${v}.short`),
    full: t(`schedule.weekdays.${v}.full`),
  }))
}
