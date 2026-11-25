<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  LayoutDashboard,
  ListFilter,
  Fingerprint,
  Globe,
  Code2,
  Activity,
  Settings,
  Info,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-vue-next';
import BrandLogo from './components/BrandLogo.vue';
import StatusPill from './components/StatusPill.vue';
import OverviewView from './views/OverviewView.vue';
import FiltersView from './views/FiltersView.vue';
import PrivacyView from './views/PrivacyView.vue';
import ExceptionsView from './views/ExceptionsView.vue';
import RulesView from './views/RulesView.vue';
import ActivityView from './views/ActivityView.vue';
import SettingsView from './views/SettingsView.vue';
import AboutView from './views/AboutView.vue';
import {
  web,
  api,
  loadPrefs,
  savePrefs,
  tr,
  version,
  readCenter,
  setDefault,
  hostname,
  formatCountdown,
} from './api';
import type {
  StealthConfig,
  TimerState,
  StatsData,
  DnrDiagnostics,
  ActivitySnapshot,
  RulesetDetail,
} from './types';

const pages = [
  'overview',
  'filters',
  'privacy',
  'exceptions',
  'rules',
  'activity',
  'settings',
  'about',
  'welcome',
];
const initial = new URL(location.href).searchParams.get('pane') || 'overview';
const pane = ref(
  pages.includes(initial) ? initial : initial === 'rulesets' ? 'filters' : 'overview'
);

const config = ref<any>(null);
const modes = ref<any>({ none: [] });
const stats = ref<StatsData>({ enabled: false, days: {}, total: 0 });
const imported = ref<any[]>([]);
const stealth = ref<StealthConfig>({
  blockPing: false,
  stripReferrer: false,
  stripClientData: false,
  stripUtmCustom: false,
});
const timers = ref<TimerState>({ global: null, sites: {} });
const diagnostics = ref<DnrDiagnostics | null>(null);
const activity = ref<ActivitySnapshot | null>(null);

const loading = ref(true);
const busy = ref(false);
const toast = ref('');
const bad = ref(false);
const mobile = ref(false);
const period = ref(7);

const rules = ref('');
const ruleOriginal = ref('');
const picked = ref<Array<[string, string[]]>>([]);
const nowMs = ref(Date.now());

let toastTimer: any;
let tickTimer: any;
let channel: BroadcastChannel | undefined;
let refreshGeneration = 0;

const nav = computed(() => [
  { id: 'overview', section: 'monitor', label: tr('Tổng quan', 'Overview'), icon: LayoutDashboard },
  { id: 'filters', section: 'blocking', label: tr('Bộ lọc quảng cáo', 'Ad filters'), icon: ListFilter },
  { id: 'privacy', section: 'blocking', label: tr('Bảo vệ riêng tư', 'Privacy & Stealth'), icon: Fingerprint },
  { id: 'exceptions', section: 'rules', label: tr('Trang web cho phép', 'Allowlist'), icon: Globe },
  { id: 'rules', section: 'rules', label: tr('Quy tắc & Phần tử', 'My rules'), icon: Code2 },
  { id: 'activity', section: 'monitor', label: tr('Nhật ký lọc', 'Filtering log'), icon: Activity },
  { id: 'settings', section: 'system', label: tr('Cài đặt', 'Settings'), icon: Settings },
  { id: 'about', section: 'system', label: tr('Giới thiệu', 'About'), icon: Info },
]);

const descriptions = computed<Record<string, string>>(() => ({
  overview: tr(
    'Giám sát bảo vệ, lớp lá chắn hội tụ và cấu hình nhanh.',
    'Monitor protection, unified shields and quick presets.'
  ),
  filters: tr(
    'Quản lý danh sách lọc quảng cáo, khu vực và bộ lọc tùy chỉnh.',
    'Manage ad blocking, regional and custom filter lists.'
  ),
  privacy: tr(
    'Chế độ tàng hình AdGuard Stealth MV3, chống theo dõi và chặn phiền nhiễu.',
    'AdGuard MV3 Stealth mode, anti-tracking and annoyance shields.'
  ),
  exceptions: tr(
    'Quản lý trang web được cho phép (nhập đơn lẻ hoặc hàng loạt).',
    'Manage allowlisted websites individually or in bulk.'
  ),
  rules: tr(
    'Trình tạo quy tắc nhanh, quy tắc tùy chỉnh và phần tử đã ẩn.',
    'Quick rule builder, custom filter rules and hidden elements.'
  ),
  activity: tr(
    'Nhật ký quy tắc khớp theo tab và thanh tra chi tiết điều kiện DNR.',
    'Per-tab matched rule log and live DNR rule inspector.'
  ),
  settings: tr(
    'Mức bảo vệ, hành vi, giao diện, sao lưu và chẩn đoán MV3.',
    'Protection level, behavior, appearance, backup and MV3 diagnostics.'
  ),
  about: tr(
    'Thông tin phiên bản, mã nguồn GPL-3.0 và cam kết không telemetry.',
    'Version, GPL-3.0 source code and zero-telemetry commitment.'
  ),
  welcome: tr(
    'Thiết lập nhanh Origin uBlock trong vài bước.',
    'Set up Origin uBlock in a few quick steps.'
  ),
}));

const title = computed(
  () => nav.value.find((n) => n.id === pane.value)?.label || tr('Hướng dẫn bắt đầu', 'Getting started')
);

const enabledSet = computed(() => new Set<string>(config.value?.enabledRulesets || []));
const protectedOn = computed(() => Number(config.value?.defaultFilteringMode) > 0);
const restricted = computed(() => config.value?.disabledFeatures?.includes('dashboard') === true);
const modeRestricted = computed(
  () => restricted.value || config.value?.disabledFeatures?.includes('filteringMode') === true
);
const listData = computed<RulesetDetail[]>(() => config.value?.rulesetDetails || []);
const ruleCount = computed(() =>
  listData.value
    .filter((r) => enabledSet.value.has(r.id))
    .reduce((n, r) => n + (r.rules?.plain || 0) + (r.rules?.regex || 0), 0)
);
const exceptions = computed(() =>
  (modes.value.none || []).filter((h: string) => h !== 'all-urls').sort()
);
const dirty = computed(() => rules.value !== ruleOriginal.value);

function navBadge(id: string): string | null {
  if (!config.value) return null;
  if (id === 'filters') return String(enabledSet.value.size);
  if (id === 'exceptions' && exceptions.value.length > 0) return String(exceptions.value.length);
  return null;
}

function notify(s: string, error = false) {
  toast.value = s;
  bad.value = error;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = '';
  }, 4200);
}

const saved = () => notify(tr('Đã lưu thay đổi', 'Changes saved'));

async function refresh() {
  const generation = ++refreshGeneration;
  try {
    const d = await readCenter();
    if (generation !== refreshGeneration) return;
    config.value = d.config;
    modes.value = d.modes;
    stats.value = d.stats;
    imported.value = d.imported;
    stealth.value = d.stealth;
    timers.value = d.timers;
    diagnostics.value = d.diagnostics;
    if (restricted.value && pane.value !== 'about') pane.value = 'about';
    const a = await web.storage.session.get('origin.activity');
    if (generation === refreshGeneration) activity.value = a['origin.activity'] || null;
  } catch (e: any) {
    if (generation === refreshGeneration) notify(e.message || String(e), true);
  } finally {
    if (generation === refreshGeneration) loading.value = false;
  }
}

async function loadRules() {
  const [text, p] = await Promise.all([
    api('getSandboxFilters'),
    api('getAllCustomFilters'),
  ]);
  rules.value = ruleOriginal.value = typeof text === 'string' ? text : '';
  picked.value = Array.isArray(p) ? p : [];
}

async function go(p: string) {
  if (restricted.value && p !== 'about') return;
  if (
    dirty.value &&
    pane.value === 'rules' &&
    p !== 'rules' &&
    !confirm(tr('Bỏ thay đổi quy tắc chưa lưu?', 'Discard unsaved rule changes?'))
  ) {
    return;
  }
  pane.value = p;
  mobile.value = false;
  history.replaceState(null, '', '?pane=' + p);
  if (p === 'rules') await loadRules();
}

async function run(fn: () => Promise<any>, message = true) {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
    if (message) saved();
  } catch (e: any) {
    notify(e.message || tr('Không thể áp dụng', 'Could not apply'), true);
  } finally {
    busy.value = false;
    await refresh();
  }
}

const globalToggle = () =>
  run(async () => {
    const target = !protectedOn.value;
    const actual = await api('originGlobalToggle', { enabled: target });
    if ((actual > 0) !== target) {
      throw Error(tr('Không thể thay đổi bảo vệ toàn cục', 'Could not change global protection'));
    }
  });

const timedPauseGlobal = (minutes: number) =>
  run(async () => {
    await api('originTimedPause', { scope: 'global', minutes });
    notify(tr(`Đã tạm dừng toàn cục ${minutes} phút`, `Paused globally for ${minutes} minutes`));
  }, false);

const cancelGlobalTimer = () =>
  run(async () => {
    await api('originCancelTimer', { scope: 'global' });
    notify(tr('Đã bật lại bảo vệ toàn cục', 'Global protection resumed'));
  }, false);

const levelChange = (n: number) => run(() => setDefault(n));

const applyPreset = (preset: 'balanced' | 'adguard' | 'max') =>
  run(async () => {
    await api('originApplyPreset', { preset });
    notify(tr('Đã áp dụng hồ sơ bảo vệ', 'Protection preset applied'));
  }, false);

function toggleList(r: RulesetDetail) {
  return run(async () => {
    const ids = new Set<string>(await api('getEnabledRulesets'));
    const target = !ids.has(r.id);
    target ? ids.add(r.id) : ids.delete(r.id);
    await api('applyRulesets', { enabledRulesets: [...ids] });
    const actual = await api<string[]>('getEnabledRulesets');
    if (actual.includes(r.id) !== target) {
      throw Error(
        tr(
          'Không thể áp dụng danh sách (có thể đã đạt giới hạn MV3)',
          'Could not apply list (MV3 limit may be reached)'
        )
      );
    }
  });
}

function addList(urlInput: string) {
  return run(async () => {
    const u = new URL(urlInput);
    if (u.protocol !== 'https:' || u.username || u.password) {
      throw Error(tr('Chỉ hỗ trợ URL HTTPS công khai', 'Public HTTPS URLs only'));
    }
    await api('importFilterList', { url: u.href });
    if (!(await api<string[]>('getEnabledRulesets')).includes(u.href)) {
      throw Error(tr('Không thể nhập danh sách', 'Could not import list'));
    }
  });
}

function removeList(id: string) {
  if (!confirm(tr('Xóa bộ lọc tùy chỉnh này?', 'Remove this custom filter?'))) return;
  return run(async () => {
    const ids = (await api<string[]>('getEnabledRulesets')).filter((x) => x !== id);
    await api('applyRulesets', { enabledRulesets: ids, toRemove: [id] });
  });
}

const updateLists = () =>
  run(async () => {
    const r = await api('originRefreshLists');
    if (!r || !Number.isInteger(r.count)) throw Error(tr('Cập nhật thất bại', 'Update failed'));
    notify(
      tr(
        'Đã kiểm tra bộ lọc tùy chỉnh; bộ lọc tích hợp cập nhật theo bản phát hành.',
        'Custom lists checked; built-in lists update with releases.'
      )
    );
  }, false);

const toggleStealth = (key: keyof StealthConfig) =>
  run(async () => {
    const next = !stealth.value[key];
    await api('originSetStealth', { stealth: { [key]: next } });
  });

function addHost(rawHost: string, editOld = '') {
  return run(async () => {
    const h = hostname(rawHost);
    if (editOld && editOld !== h) {
      if (!(await api('originException', { hostname: h }))) {
        throw Error(tr('Không thể thêm ngoại lệ', 'Could not add exception'));
      }
      if (!(await api('originException', { hostname: editOld, remove: true }))) {
        throw Error(tr('Không thể xóa ngoại lệ cũ', 'Could not remove old exception'));
      }
    } else if (!(await api('originException', { hostname: h }))) {
      throw Error(tr('Không thể thêm ngoại lệ', 'Could not add exception'));
    }
  });
}

const removeHost = (h: string) =>
  run(async () => {
    if (!(await api('originException', { hostname: h, remove: true }))) {
      throw Error(tr('Không thể xóa ngoại lệ', 'Could not remove exception'));
    }
  });

const bulkAddExceptions = (hosts: string[]) =>
  run(async () => {
    const res = await api('originBulkExceptions', { hostnames: hosts, action: 'add' });
    notify(tr(`Đã thêm ${res?.changed || 0} tên miền vào ngoại lệ`, `Added ${res?.changed || 0} allowlisted domains`));
  }, false);

const clearAllExceptions = (hosts: string[]) => {
  if (!confirm(tr('Xóa toàn bộ trang web ngoại lệ?', 'Clear all allowlisted websites?'))) return;
  return run(async () => {
    await api('originBulkExceptions', { hostnames: hosts, action: 'remove' });
  });
};

const saveRules = () =>
  run(async () => {
    if (rules.value.length > 2_000_000) throw Error(tr('Tệp quy tắc quá lớn', 'Rules file is too large'));
    await api('setSandboxFilters', { text: rules.value });
    const actual = await api('getSandboxFilters');
    if ((typeof actual === 'string' ? actual : '').trim() !== rules.value.trim()) {
      throw Error(tr('Không thể lưu quy tắc', 'Could not save rules'));
    }
    ruleOriginal.value = rules.value;
  });

const removePicked = (h: string, s: string) =>
  run(async () => {
    await api('removeCustomFilters', { hostname: h, selectors: [s] });
    await loadRules();
  });

const removeAllPicked = (h: string) => {
  if (!confirm(tr(`Xóa toàn bộ phần tử đã ẩn của ${h}?`, `Remove all hidden elements for ${h}?`))) return;
  return run(async () => {
    await api('removeAllCustomFilters', { hostname: h });
    await loadRules();
  });
};

const changeSetting = (msg: string, current: boolean) =>
  run(async () => {
    await api(msg, { state: !current });
  });

const toggleDeveloper = () =>
  run(async () => {
    await api('setDeveloperMode', { state: !config.value.developerMode });
  });

const toggleStats = () => run(() => api('originSetStats', { enabled: !stats.value.enabled }));

const clearStats = () => {
  if (confirm(tr('Xóa toàn bộ thống kê cục bộ?', 'Clear all local statistics?'))) {
    return run(() => api('originClearStats'));
  }
};

async function exportSettings() {
  await run(async () => {
    const path = web.runtime.getURL('js/backup-restore.js');
    const mod = await import(/* @vite-ignore */ path);
    const data = await mod.backupToObject(config.value);
    const a = document.createElement('a');
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    );
    a.href = url;
    a.download = 'origin-ublock-settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, false);
}

async function restoreSettings(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  try {
    if (f.size > 4_000_000) throw Error(tr('Tệp quá lớn', 'File too large'));
    const d = JSON.parse(await f.text());
    if (!d || typeof d !== 'object' || Array.isArray(d) || !d.filteringModes) {
      throw Error(tr('Tệp sao lưu không hợp lệ', 'Invalid backup file'));
    }
    if (!confirm(tr('Khôi phục sẽ thay thế cấu hình đang dùng. Tiếp tục?', 'Restore replaces current configuration. Continue?'))) {
      return;
    }
    await run(async () => {
      const path = web.runtime.getURL('js/backup-restore.js');
      const mod = await import(/* @vite-ignore */ path);
      await mod.restoreFromObject(d);
    });
  } catch (err: any) {
    notify(err.message || String(err), true);
  } finally {
    input.value = '';
  }
}

function reset() {
  if (!confirm(tr('Đưa toàn bộ cài đặt lọc về mặc định?', 'Reset all filtering settings to defaults?'))) return;
  return run(async () => {
    const path = web.runtime.getURL('js/backup-restore.js');
    const mod = await import(/* @vite-ignore */ path);
    await mod.restoreFromObject({});
  });
}

async function prefs() {
  await savePrefs();
  saved();
}

onMounted(async () => {
  await loadPrefs();
  await refresh();
  if (pane.value === 'rules') await loadRules();
  channel = new BroadcastChannel('uBOL');
  channel.onmessage = () => {
    if (!busy.value) void refresh();
  };
  window.addEventListener('focus', refresh);
  tickTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  channel?.close();
  window.removeEventListener('focus', refresh);
  clearTimeout(toastTimer);
  clearInterval(tickTimer);
});
</script>

<template>
  <div class="dashboard-shell">
    <aside class="sidebar" :class="{ mobile }">
      <div class="brand">
        <BrandLogo :size="22" />
        <div>
          <b>Origin uBlock</b>
          <small>PROTECTION CENTER</small>
        </div>
      </div>

      <nav class="side-nav" :aria-label="tr('Điều hướng chính', 'Main navigation')">
        <button
          v-for="n in nav"
          :key="n.id"
          type="button"
          :class="{ selected: pane === n.id }"
          :disabled="restricted && n.id !== 'about'"
          @click="go(n.id)"
        >
          <component :is="n.icon" :size="18" :stroke-width="1.9" />
          <span>{{ n.label }}</span>
          <span v-if="navBadge(n.id)" class="nav-badge">{{ navBadge(n.id) }}</span>
          <ChevronRight v-else-if="pane === n.id" :size="14" class="nav-arrow" />
        </button>
      </nav>

      <div class="side-footer">
        <button type="button" @click="go('welcome')">
          <BookOpen :size="15" />
          <span>{{ tr('Hướng dẫn bắt đầu', 'Getting started') }}</span>
        </button>
        <small>Lowji Edition · v{{ version }}</small>
      </div>
    </aside>

    <main class="dashboard-main">
      <header class="topbar">
        <div class="crumb">
          <button
            type="button"
            class="icon-button mobile-toggle"
            :aria-label="tr('Mở menu', 'Toggle menu')"
            @click="mobile = !mobile"
          >
            <Menu :size="20" />
          </button>
          <ShieldCheck :size="16" style="color: var(--accent)" />
          <span>Origin uBlock</span>
          <ChevronRight :size="13" />
          <b>{{ title }}</b>
        </div>
        <div class="topbar-right">
          <StatusPill
            v-if="config"
            :tone="timers.global ? 'warning' : protectedOn ? 'success' : 'neutral'"
            :label="
              timers.global
                ? formatCountdown(timers.global.resumeAt, nowMs)
                : protectedOn
                  ? tr('Đang bảo vệ', 'Protected')
                  : tr('Đang tạm dừng', 'Paused')
            "
          />
          <button
            type="button"
            class="icon-button"
            :title="tr('Cài đặt', 'Settings')"
            :aria-label="tr('Cài đặt', 'Settings')"
            @click="go('settings')"
          >
            <Settings :size="19" />
          </button>
        </div>
      </header>

      <div class="content">
        <div class="page-header">
          <div>
            <h1>{{ title }}</h1>
            <p>{{ descriptions[pane] }}</p>
          </div>
          <button type="button" class="btn secondary" :disabled="busy || loading" @click="refresh">
            <RefreshCw :size="15" />
            <span>{{ tr('Làm mới', 'Refresh') }}</span>
          </button>
        </div>

        <div v-if="loading" class="panel">{{ tr('Đang kết nối engine…', 'Connecting to engine…') }}</div>
        <div v-else-if="!config" class="panel">
          {{ tr('Không thể tải cấu hình. Hãy nhấn Làm mới.', 'Unable to load configuration. Refresh to retry.') }}
        </div>

        <template v-else>
          <OverviewView
            v-if="pane === 'overview'"
            v-model:period="period"
            :config="config"
            :stats="stats"
            :stealth="stealth"
            :timers="timers"
            :exceptions="exceptions"
            :custom-sites-count="diagnostics?.customSitesCount || 0"
            :enabled-set="enabledSet"
            :list-data="listData"
            :rule-count="ruleCount"
            :protected-on="protectedOn"
            :mode-restricted="modeRestricted"
            :busy="busy"
            :now-ms="nowMs"
            @global-toggle="globalToggle"
            @timed-pause-global="timedPauseGlobal"
            @cancel-global-timer="cancelGlobalTimer"
            @toggle-stats="toggleStats"
            @apply-preset="applyPreset"
            @go="go"
          />

          <FiltersView
            v-else-if="pane === 'filters'"
            :list-data="listData"
            :enabled-set="enabledSet"
            :rule-count="ruleCount"
            :max-rulesets="config.maxNumberOfEnabledRulesets || 50"
            :admin-rulesets="config.adminRulesets || []"
            :supports-user-scripts="Boolean(config.supportsUserScripts)"
            :busy="busy"
            @toggle-list="toggleList"
            @add-list="addList"
            @remove-list="removeList"
            @update-lists="updateLists"
            @refresh="refresh"
            @apply-preset="applyPreset"
          />

          <PrivacyView
            v-else-if="pane === 'privacy'"
            :config="config"
            :stealth="stealth"
            :list-data="listData"
            :enabled-set="enabledSet"
            :admin-rulesets="config.adminRulesets || []"
            :busy="busy"
            @toggle-stealth="toggleStealth"
            @toggle-list="toggleList"
            @change-setting="changeSetting"
          />

          <ExceptionsView
            v-else-if="pane === 'exceptions'"
            :exceptions="exceptions"
            :protected-on="protectedOn"
            :mode-restricted="modeRestricted"
            :busy="busy"
            @add-host="addHost"
            @remove-host="removeHost"
            @bulk-add="bulkAddExceptions"
            @clear-all="clearAllExceptions"
          />

          <RulesView
            v-else-if="pane === 'rules'"
            v-model:rules="rules"
            :rule-original="ruleOriginal"
            :picked="picked"
            :user-rules-count="diagnostics?.userRulesCount || 0"
            :supports-user-scripts="Boolean(config.supportsUserScripts)"
            :busy="busy"
            @save-rules="saveRules"
            @revert-rules="rules = ruleOriginal"
            @remove-picked="removePicked"
            @remove-all-picked="removeAllPicked"
            @notify="notify"
          />

          <ActivityView
            v-else-if="pane === 'activity'"
            :activity="activity"
            :list-data="listData"
            @refresh="refresh"
          />

          <SettingsView
            v-else-if="pane === 'settings'"
            :config="config"
            :stats="stats"
            :diagnostics="diagnostics"
            :mode-restricted="modeRestricted"
            :busy="busy"
            @level-change="levelChange"
            @change-setting="changeSetting"
            @toggle-developer="toggleDeveloper"
            @toggle-stats="toggleStats"
            @prefs-change="prefs"
            @export-settings="exportSettings"
            @restore-settings="restoreSettings"
            @clear-stats="clearStats"
            @reset="reset"
          />

          <AboutView
            v-else
            :pane="pane === 'welcome' ? 'welcome' : 'about'"
            :config="config"
            :mode-restricted="modeRestricted"
            :busy="busy"
            @level-change="levelChange"
            @apply-preset="applyPreset"
            @go="go"
          />
        </template>
      </div>
    </main>

    <div v-if="toast" class="toast" :class="{ bad }" role="status">
      <component :is="bad ? AlertCircle : CheckCircle2" :size="18" />
      <span>{{ toast }}</span>
      <button type="button" :aria-label="tr('Đóng thông báo', 'Dismiss')" @click="toast = ''">
        <X :size="16" />
      </button>
    </div>
  </div>
</template>
