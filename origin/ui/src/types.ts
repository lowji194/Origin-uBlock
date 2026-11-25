export type LangCode = 'vi' | 'en';
export type ThemePref = 'system' | 'light' | 'dark';
export type SemanticTone = 'success' | 'danger' | 'warning' | 'info' | 'scheduled' | 'neutral' | 'accent';

export interface RulesetRulesStats {
    total?: number;
    plain?: number;
    regex?: number;
    rejected?: number;
    strictblock?: number;
    urlskip?: number;
}

export interface RulesetDetail {
    id: string;
    name: string;
    group?: string;
    lang?: string;
    tags?: string;
    parent?: string;
    enabled?: boolean;
    trusted?: boolean;
    homeURL?: string;
    time?: {
        added?: number;
        updated?: number;
    };
    rules?: RulesetRulesStats;
    filters?: {
        total?: number;
        accepted?: number;
        rejected?: number;
    };
    css?: {
        specific?: number;
        generic?: number;
    };
}

export interface StealthConfig {
    blockPing: boolean;
    stripReferrer: boolean;
    stripClientData: boolean;
    stripUtmCustom: boolean;
}

export interface TimerState {
    global: { resumeAt: number; prevMode: number } | null;
    sites: Record<string, { resumeAt: number; prevLevel: number }>;
}

export interface StatsData {
    enabled: boolean;
    days: Record<string, number>;
    total?: number;
}

export interface DnrDiagnostics {
    availableStaticRuleCount: number | null;
    maxStaticRulesets: number;
    enabledRulesetsCount: number;
    dynamicRulesCount: number;
    sessionRulesCount: number;
    userRulesCount: number;
    stealthRulesCount: number;
    customSitesCount: number;
}

export interface MatchedRuleEntry {
    timeStamp: number;
    rule?: {
        rulesetId?: string;
        ruleId?: number;
    };
    request?: Record<string, unknown>;
}

export interface ActivitySnapshot {
    hostname: string;
    at: number;
    unavailable?: boolean;
    matches?: MatchedRuleEntry[];
}
