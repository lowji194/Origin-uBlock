import { ref, computed } from 'vue';
import type {
    LangCode,
    ThemePref,
    StealthConfig,
    TimerState,
    StatsData,
    DnrDiagnostics,
    ActivitySnapshot,
    RulesetDetail,
} from './types';

declare const chrome: any;
export const web = chrome;
export const version: string = web.runtime.getManifest().version;

export const language = ref<LangCode>(
    web.i18n.getUILanguage().startsWith('vi') ? 'vi' : 'en'
);
export const theme = ref<ThemePref>('system');

export const tr = (vi: string, en: string): string =>
    language.value === 'vi' ? vi : en;

export const modeName = (n: number): string =>
    [
        tr('Tắt', 'Off'),
        tr('Cơ bản', 'Basic'),
        tr('Tối ưu', 'Optimal'),
        tr('Tối đa', 'Complete'),
    ][n] || '—';

export const num = (n: number): string =>
    Number(n || 0).toLocaleString(language.value === 'vi' ? 'vi-VN' : 'en-US');

const media = matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
    document.documentElement.dataset.theme =
        theme.value === 'system' ? (media.matches ? 'dark' : 'light') : theme.value;
    document.documentElement.lang = language.value;
}

export async function loadPrefs() {
    const s = await web.storage.local.get(['origin.ui.theme', 'origin.ui.language']);
    if (['system', 'light', 'dark'].includes(s['origin.ui.theme'])) {
        theme.value = s['origin.ui.theme'];
    }
    if (['vi', 'en'].includes(s['origin.ui.language'])) {
        language.value = s['origin.ui.language'];
    }
    applyTheme();
}

export async function savePrefs() {
    applyTheme();
    await web.storage.local.set({
        'origin.ui.theme': theme.value,
        'origin.ui.language': language.value,
    });
}

media.addEventListener('change', applyTheme);
web.storage.onChanged.addListener((changes: any, area: string) => {
    if (area === 'local' && (changes['origin.ui.theme'] || changes['origin.ui.language'])) {
        void loadPrefs();
    }
});

export async function api<T = any>(what: string, extra: Record<string, any> = {}): Promise<T> {
    return web.runtime.sendMessage({ what, ...extra });
}

export async function navigate(pane: string) {
    await web.tabs.create({
        url: web.runtime.getURL('dashboard.html?pane=' + encodeURIComponent(pane)),
    });
}

export async function readCenter() {
    const [config, modes, stats, imported, stealth, timers, diagnostics] = await Promise.all([
        api('getOptionsPageData'),
        api('getFilteringModeDetails'),
        api<StatsData>('originGetStats'),
        api('getImportedLists'),
        api<StealthConfig>('originGetStealth'),
        api<TimerState>('originGetTimers'),
        api<DnrDiagnostics>('originGetDnrDiagnostics'),
    ]);
    if (!config || !modes || !stats) {
        throw Error(tr('Không kết nối được engine', 'Could not connect to engine'));
    }
    return {
        config,
        modes,
        stats,
        imported: imported || [],
        stealth: stealth || {
            blockPing: false,
            stripReferrer: false,
            stripClientData: false,
            stripUtmCustom: false,
        },
        timers: timers || { global: null, sites: {} },
        diagnostics: diagnostics || null,
    };
}

export async function setDefault(level: number) {
    if (level > 1 && !(await web.permissions.contains({ origins: ['<all_urls>'] }))) {
        if (!(await web.permissions.request({ origins: ['<all_urls>'] }))) {
            throw Error(tr('Chưa cấp quyền truy cập website', 'Site permission not granted'));
        }
    }
    const actual = await api('setDefaultFilteringMode', { level });
    if (actual !== level) {
        throw Error(tr('Không thể đổi mức bảo vệ', 'Could not change protection level'));
    }
    return actual;
}

export function hostname(raw: string): string {
    const cleaned = raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const url = new URL('https://' + cleaned);
    const h = url.hostname.toLowerCase().replace(/\.$/, '');
    if (
        !h.includes('.') ||
        h === 'all-urls' ||
        h.includes('..') ||
        url.username ||
        url.password ||
        !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(h)
    ) {
        throw Error(tr('Tên miền không hợp lệ', 'Invalid hostname'));
    }
    return h;
}

export function download(name: string, text: string, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function snapshot(tabId: number, host: string): Promise<ActivitySnapshot> {
    let result: ActivitySnapshot = { hostname: host, at: Date.now(), unavailable: true };
    try {
        const data = await web.declarativeNetRequest.getMatchedRules({ tabId });
        result = {
            hostname: host,
            at: Date.now(),
            matches: data.rulesMatchedInfo || [],
        };
    } catch {
        // Fallback: matched rules API requires declarativeNetRequestFeedback or activeTab grant
    }
    await web.storage.session.set({ 'origin.activity': result });
    return result;
}

export function formatCountdown(resumeAt: number, nowMs: number): string {
    const diff = Math.max(0, Math.ceil((resumeAt - nowMs) / 1000));
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    const pad = (v: number) => String(v).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

/** Extract clean display title and ISO flag code from upstream regional names or custom Vietnam filter URLs. */
export function parseRulesetDisplay(r: RulesetDetail): {
    flagCode: string | null;
    title: string;
} {
    const raw = String(r.name || r.id || '');
    const match = /^((?:[\u{1F1E6}-\u{1F1FF}]{2})+)(?:\s*([a-z]{2})\s*:\s*|\s*)(.+)$/u.exec(raw);
    if (match) {
        const glyphs = Array.from(match[1]).slice(0, 2);
        const emojiCode = glyphs
            .map((ch) => String.fromCharCode(ch.codePointAt(0)! - 0x1F1E6 + 97))
            .join('');
        const flagCode = (match[2] || emojiCode || '').toLowerCase() || null;
        return { flagCode, title: match[3].trim() || raw };
    }
    const stripped = raw.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
    let flagCode: string | null = r.lang === 'vi' ? 'vn' : null;
    if (!flagCode) {
        try {
            const u = new URL(r.id);
            if (
                u.hostname === 'raw.githubusercontent.com' &&
                /^\/lowji194\/AdsBlock-Filter\/main\/filters\/(?:Vietnam_Filter_(?:Desktop|Mobile)|AdGuard_(?:Desktop|Android))\.txt$/i.test(
                    u.pathname
                )
            ) {
                flagCode = 'vn';
            }
        } catch {
            // Non-URL ruleset id
        }
    }
    return { flagCode, title: stripped || raw };
}

export const groupMeta = computed(() => ({
    default: { name: tr('Cơ bản', 'Essential'), tone: 'success' as const },
    ads: { name: tr('Quảng cáo', 'Ads'), tone: 'danger' as const },
    regions: { name: tr('Khu vực', 'Regional'), tone: 'info' as const },
    privacy: { name: tr('Riêng tư', 'Privacy'), tone: 'info' as const },
    annoyances: { name: tr('Phiền nhiễu', 'Annoyances'), tone: 'warning' as const },
    malware: { name: tr('An toàn', 'Security'), tone: 'danger' as const },
    imported: { name: tr('Tùy chỉnh', 'Custom'), tone: 'scheduled' as const },
    other: { name: tr('Khác', 'Other'), tone: 'neutral' as const },
}));

export const protectionModes = computed(() => [
    {
        id: 1,
        name: modeName(1),
        short: tr('Mạng', 'Network'),
        desc: tr(
            'Chặn yêu cầu mạng quảng cáo và theo dõi.',
            'Block advertising and tracking network requests.'
        ),
    },
    {
        id: 2,
        name: modeName(2),
        short: tr('Khuyên dùng', 'Recommended'),
        desc: tr(
            'Lọc mạng, scriptlet và ẩn phần tử theo từng website.',
            'Network, scriptlets and site-specific cosmetic filtering.'
        ),
    },
    {
        id: 3,
        name: modeName(3),
        short: tr('Nâng cao', 'Aggressive'),
        desc: tr(
            'Bổ sung lọc giao diện tổng quát. Có thể ảnh hưởng hiển thị.',
            'Adds generic cosmetic filtering. May affect site layouts.'
        ),
    },
]);
