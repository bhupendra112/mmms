/**
 * MEETING UNIQUENESS: meetingKey = groupId + meetingDate + meetingSequence
 * NORMAL DEMAND vs MISSING DEMAND: gapDays threshold = 10 (applied with recoveryDate vs meetingDate)
 */

/** @param {Date|string} d */
export function normalizeDateOnly(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime())) return null;
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

export function meetingKeyString(groupId, meetingDate, meetingSequence) {
    const g = groupId?.toString?.() ?? String(groupId);
    const md = normalizeDateOnly(meetingDate);
    if (!md) return `${g}:invalid`;
    const y = md.getFullYear();
    const m = String(md.getMonth() + 1).padStart(2, "0");
    const day = String(md.getDate()).padStart(2, "0");
    return `${g}:${y}-${m}-${day}:${meetingSequence}`;
}

/** Ordinal comparison: -1 if a before b, 0 equal, 1 if a after b */
export function compareMeetings(a, b) {
    const ta = normalizeDateOnly(a.meetingDate).getTime();
    const tb = normalizeDateOnly(b.meetingDate).getTime();
    if (ta !== tb) return ta < tb ? -1 : 1;
    const sa = a.meetingSequence || 1;
    const sb = b.meetingSequence || 1;
    if (sa === sb) return 0;
    return sa < sb ? -1 : 1;
}

/**
 * Meetings in calendar month (year, monthIndex 0-11), ordered by date.
 * Meeting 2 can fall in the next month if its day is before meeting 1 day.
 */
export function getMeetingsInMonth(year, monthIndex, groupDoc) {
    const d1 = groupDoc?.meeting_date_1_day;
    const d2 = groupDoc?.meeting_date_2_day;
    const out = [];
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();

    if (d1 != null) {
        const dd = Math.min(d1, lastDay);
        const dt = normalizeDateOnly(new Date(year, monthIndex, dd));
        out.push({ meetingDate: dt, meetingSequence: 1 });
    }
    if (d2 != null) {
        let y2 = year;
        let m2 = monthIndex;
        if (d1 != null && d2 < d1) {
            m2 += 1;
            if (m2 > 11) {
                m2 = 0;
                y2 += 1;
            }
        }
        const lastDay2 = new Date(y2, m2 + 1, 0).getDate();
        const dd2 = Math.min(d2, lastDay2);
        const dt2 = normalizeDateOnly(new Date(y2, m2, dd2));
        out.push({ meetingDate: dt2, meetingSequence: 2 });
    }

    out.sort((x, y) => compareMeetings(x, y));
    return out;
}

/**
 * Latest scheduled meeting on or before recoveryDate (searches current + previous calendar month).
 */
export function resolveMeetingForRecovery({ groupDoc, recoveryDate }) {
    const rd = normalizeDateOnly(recoveryDate);
    if (!rd || !groupDoc) {
        return {
            meetingDate: rd,
            meetingSequence: 1,
            gapDays: 0,
            demandStatus: "NORMAL_DEMAND",
        };
    }

    const candidates = [];
    for (let delta = 0; delta <= 1; delta++) {
        const ref = new Date(rd.getFullYear(), rd.getMonth() - delta, 1);
        const y = ref.getFullYear();
        const m = ref.getMonth();
        candidates.push(...getMeetingsInMonth(y, m, groupDoc));
    }

    let best = null;
    for (const c of candidates) {
        if (c.meetingDate.getTime() <= rd.getTime()) {
            if (!best || compareMeetings(c, best) > 0) best = c;
        }
    }

    if (!best) {
        const y = rd.getFullYear();
        const m = rd.getMonth();
        const meetings = getMeetingsInMonth(y, m, groupDoc);
        best = meetings[0] || { meetingDate: rd, meetingSequence: 1 };
    }

    const gapMs = rd.getTime() - best.meetingDate.getTime();
    const gapDays = Math.floor(gapMs / (86400000));
    const demandStatus = gapDays > 10 ? "MISSING_DEMAND" : "NORMAL_DEMAND";

    return {
        meetingDate: best.meetingDate,
        meetingSequence: best.meetingSequence,
        gapDays,
        demandStatus,
    };
}

/**
 * Immediately preceding scheduled meeting before (meetingDate, meetingSequence).
 */
/**
 * All scheduled meetings M with lowerExclusive < M < upperExclusive (strict).
 * @param {object|null} lowerExclusive - last finalized anchor (or null = no ledger spine; caller may still pass group window)
 * @param {{ meetingDate: Date, meetingSequence?: number }} upperExclusive - current meeting being finalized
 */
export function listScheduledMeetingsStrictlyBetween(
    groupDoc,
    lowerExclusive,
    upperExclusive
) {
    if (!groupDoc || !upperExclusive?.meetingDate) return [];
    const hi = normalizeDateOnly(upperExclusive.meetingDate);
    if (!hi) return [];

    let startY = hi.getFullYear();
    let startM = hi.getMonth();

    if (lowerExclusive?.meetingDate) {
        const lo = normalizeDateOnly(lowerExclusive.meetingDate);
        if (lo) {
            startY = lo.getFullYear();
            startM = lo.getMonth();
        }
    } else {
        const cap = new Date(hi.getFullYear(), hi.getMonth() - 36, 1);
        startY = cap.getFullYear();
        startM = cap.getMonth();
    }

    const collected = [];
    let y = startY;
    let mo = startM;
    const hiY = hi.getFullYear();
    const hiM = hi.getMonth();

    const monthLte = (yy, mm) =>
        yy < hiY || (yy === hiY && mm <= hiM);

    while (monthLte(y, mo) && collected.length < 400) {
        collected.push(...getMeetingsInMonth(y, mo, groupDoc));
        mo += 1;
        if (mo > 11) {
            mo = 0;
            y += 1;
        }
    }

    const seen = new Map();
    for (const mt of collected) {
        const k = `${mt.meetingDate.getTime()}_${mt.meetingSequence || 1}`;
        if (!seen.has(k)) seen.set(k, mt);
    }
    const list = [...seen.values()].sort((a, b) => compareMeetings(a, b));

    return list.filter((mt) => {
        if (compareMeetings(mt, upperExclusive) >= 0) return false;
        if (lowerExclusive?.meetingDate) {
            if (compareMeetings(mt, lowerExclusive) <= 0) return false;
        }
        return true;
    });
}

export function getPreviousMeeting({ groupDoc, meetingDate, meetingSequence }) {
    const md = normalizeDateOnly(meetingDate);
    if (!md || !groupDoc) return null;

    const seq = meetingSequence || 1;
    const y = md.getFullYear();
    const m = md.getMonth();

    const thisMonthMeetings = getMeetingsInMonth(y, m, groupDoc);
    const idx = thisMonthMeetings.findIndex(
        (x) =>
            x.meetingDate.getTime() === md.getTime() &&
            (x.meetingSequence || 1) === seq
    );

    if (seq === 2 && thisMonthMeetings.length >= 2) {
        return thisMonthMeetings[0];
    }

    if (seq === 1 || idx <= 0) {
        const prevMonth = m === 0 ? 11 : m - 1;
        const prevYear = m === 0 ? y - 1 : y;
        const prevMeetings = getMeetingsInMonth(prevYear, prevMonth, groupDoc);
        return prevMeetings.length ? prevMeetings[prevMeetings.length - 1] : null;
    }

    return thisMonthMeetings[0] || null;
}

/** Next upcoming meeting strictly after recoveryDate (calendar navigation). */
export function getNextMeetingDate(recoveryDate, groupDoc) {
    const d1 = groupDoc?.meeting_date_1_day;
    const d2 = groupDoc?.meeting_date_2_day;
    if (d1 == null && d2 == null) return null;
    const d = normalizeDateOnly(recoveryDate);
    if (!d) return null;
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dayA = d1 != null ? Math.min(d1, lastDay) : lastDay;
    const dayB = d2 != null ? Math.min(d2, lastDay) : lastDay;
    const dateA = new Date(year, month, dayA);
    const dateB = new Date(year, month, dayB);
    dateA.setHours(0, 0, 0, 0);
    dateB.setHours(0, 0, 0, 0);
    const firstInMonth =
        dateA.getTime() < dateB.getTime() ? dateA : dateB;
    const secondInMonth =
        dateA.getTime() < dateB.getTime() ? dateB : dateA;
    const t = d.getTime();
    if (t < firstInMonth.getTime()) return firstInMonth;
    if (t < secondInMonth.getTime()) return secondInMonth;
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextLastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
    const nextDayA = d1 != null ? Math.min(d1, nextLastDay) : nextLastDay;
    const nextDayB = d2 != null ? Math.min(d2, nextLastDay) : nextLastDay;
    const nextFirst = new Date(
        nextYear,
        nextMonth,
        Math.min(nextDayA, nextDayB)
    );
    nextFirst.setHours(0, 0, 0, 0);
    return nextFirst;
}
