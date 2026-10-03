// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
const TIERS = ['primary', 'secondary', 'tertiary', 'quaternary'];

function percent(window) {
    if (!window || typeof window !== 'object')
        return null;
    let value = window.usedPercent ?? window.used_percent;
    if (value === undefined) {
        const remaining = window.remainingPercent ?? window.remaining_percent;
        if (remaining !== undefined)
            value = 100 - Number(remaining);
    }
    if (value === undefined && Number(window.limit) > 0)
        value = 100 * Number(window.used) / Number(window.limit);
    value = Number(value);
    return Number.isFinite(value) ? Math.max(0, value) : null;
}

function quantity(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function extras(entry, usage, labels) {
    const rows = [];
    const credits = entry.credits;
    if (credits && typeof credits === 'object') {
        const remaining = quantity(credits.remaining);
        if (remaining !== null)
            rows.push({label: 'Credit balance', value: `${remaining}`});
    }
    const cost = usage.providerCost;
    if (cost && typeof cost === 'object') {
        const used = quantity(cost.used);
        const limit = quantity(cost.limit);
        const code = typeof cost.currencyCode === 'string' ? cost.currencyCode : '';
        const suffix = code ? ` ${code}` : '';
        if (used !== null) {
            const isExtra = /extra usage/i.test(cost.period || '');
            rows.push({label: isExtra ? 'Overrun / extra usage' : 'Spend',
                value: limit !== null ? `${used} / ${limit}${suffix}` : `${used}${suffix}`,
                panelValue: isExtra && used > 0 ? `+${used}${suffix}` : null,
                alert: isExtra && used > 0});
            if (limit !== null && limit > 0 && used > limit)
                rows.push({label: 'Above usage cap',
                    value: `+${(used - limit).toFixed(2)}${suffix}`, alert: true});
        }
    }
    const resets = quantity(usage.codexResetCredits?.availableCount);
    if (resets !== null)
        rows.push({label: 'Limit reset credits', value: `${resets}`});
    for (const [tier, pace] of Object.entries(entry.pace || {})) {
        if (!pace || typeof pace !== 'object')
            continue;
        const delta = quantity(pace.deltaPercent);
        if (delta !== null && delta > 0)
            rows.push({label: `${labels[tier] || tier} pace deficit`,
                value: `+${Math.round(delta)}%`,
                detail: typeof pace.summary === 'string' ? pace.summary : '', alert: true});
        else if (typeof pace.summary === 'string' && pace.summary)
            rows.push({label: `${tier} pace`, value: pace.summary});
    }
    if (Array.isArray(usage.details)) {
        for (const section of usage.details.slice(0, 4)) {
            if (!Array.isArray(section?.rows))
                continue;
            for (const row of section.rows.slice(0, 6)) {
                if (typeof row?.label === 'string' &&
                    (typeof row.value === 'string' || typeof row.value === 'number'))
                    rows.push({label: row.label, value: String(row.value)});
            }
        }
    }
    return rows;
}

export function normalizeResult(provider, json) {
    const entries = Array.isArray(json) ? json : [json];
    return entries.filter(entry => entry && typeof entry === 'object').map((entry, index) => {
        const usage = entry.usage && typeof entry.usage === 'object' ? entry.usage : {};
        const labels = entry.rateWindowLabels && typeof entry.rateWindowLabels === 'object'
            ? entry.rateWindowLabels : {};
        const windows = TIERS.flatMap(tier => {
            const raw = usage[tier];
            const used = percent(raw);
            if (used === null)
                return [];
            const minutes = Number(raw.windowMinutes ?? raw.window_minutes ?? 0);
            const name = String(labels[tier] || (minutes ? `${minutes} minutes` : tier));
            return [{name, used, resetsAt: raw.resetsAt || raw.resets_at || null,
                minutes: Number.isFinite(minutes) ? minutes : 0, tier}];
        });
        const identity = usage.accountEmail || usage.email || entry.accountLabel ||
            entry.account || entry.accountName || '';
        const account = typeof identity === 'string' ? identity : '';
        return {
            id: String(entry.provider || provider),
            account: account || (entries.length > 1 ? `Account ${index + 1}` : ''),
            windows,
            extras: extras(entry, usage, labels),
            updatedAt: typeof usage.updatedAt === 'string' ? usage.updatedAt : null,
            error: entry.error ? 'Usage unavailable' : null,
        };
    });
}

export function featuredWindow(windows) {
    if (!windows?.length)
        return null;
    return windows.find(window => /week|7.day/i.test(window.name) ||
        window.minutes >= 9000 && window.minutes <= 11000) || windows[0];
}

export function shortName(id) {
    const known = {codex: 'Cx', claude: 'Cl', opencode: 'OC', opencodego: 'OG',
        gemini: 'Gm', copilot: 'Cp', cursor: 'Cu'};
    return known[id] || id.slice(0, 2).toUpperCase();
}

export function resetText(value, now = Date.now()) {
    if (!value)
        return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '';
    const when = date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const minutesLeft = Math.ceil((date.getTime() - now) / 60000);
    if (minutesLeft <= 0)
        return `Reset due · ${when}`;
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    const left = hours > 0
        ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : `${minutes}m`;
    return `Resets in ${left} · ${when}`;
}

export function usageErrorCode(provider, message) {
    if (provider !== 'claude' || typeof message !== 'string')
        return 'UNAVAILABLE';
    if (/Claude OAuth access token missing|not logged in/i.test(message))
        return 'CLAUDE_LOGIN_REQUIRED';
    if (/No available fetch strategy for claude/i.test(message))
        return 'CLAUDE_SOURCE_UNAVAILABLE';
    return 'UNAVAILABLE';
}
