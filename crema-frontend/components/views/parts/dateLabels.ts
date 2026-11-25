/**
 * Fixed English date labels for the calendar / gantt headers, built from the Date's own (local) fields
 * instead of toLocaleDateString so the server render and the browser render produce the same text.
 * The output matches toLocaleDateString("en", …) for each format named below.
 */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const short = (s: string) => s.slice(0, 3);

/** { month: "long", year: "numeric" } → "November 2026" */
export const monthYear = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
/** { month: "short", day: "numeric" } → "Nov 18" */
export const monthDay = (d: Date) => `${short(MONTHS[d.getMonth()])} ${d.getDate()}`;
/** { month: "short", day: "numeric", year: "numeric" } → "Nov 18, 2026" */
export const monthDayYear = (d: Date) => `${monthDay(d)}, ${d.getFullYear()}`;
/** { month: "short", year: "2-digit" } → "Nov 26" */
export const monthShortYear = (d: Date) => `${short(MONTHS[d.getMonth()])} ${String(d.getFullYear() % 100).padStart(2, "0")}`;
/** { weekday: "long", month: "long", day: "numeric" } → "Wednesday, November 18" */
export const weekdayMonthDay = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
