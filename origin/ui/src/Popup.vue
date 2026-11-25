<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  Settings,
  Power,
  Crosshair,
  ListFilter,
  LayoutDashboard,
  Activity,
  RotateCw,
  AlertCircle,
  ShieldBan,
  SlidersHorizontal,
  EyeOff,
  RotateCcw,
  Flag,
  Fingerprint,
  Clock,
  ChevronRight,
  Globe,
} from 'lucide-vue-next';
import BrandLogo from './components/BrandLogo.vue';
import StatusPill from './components/StatusPill.vue';
import SiteFooter from './components/SiteFooter.vue';
import {
  web,
  api,
  loadPrefs,
  tr,
  version,
  modeName,
  protectionModes,
  navigate,
  snapshot,
  num,
  formatCountdown,
} from './api';
import type { StealthConfig, TimerState, StatsData } from './types';

const tab = ref<any>(null);
const host = ref('');
const level = ref(0);
const globalMode = ref(0);
const count = ref<number | null>(null);
const lists = ref(0);
const customCount = ref(0);
const busy = ref(true);
const error = ref('');
const forbid = ref<string[]>([]);
const autoReload = ref(true);
const last = ref(2);
const stats = ref<StatsData>({ enabled: false, days: {}, total: 0 });
const stealth = ref<StealthConfig>({
  blockPing: false,
  stripReferrer: false,
  stripClientData: false,
  stripUtmCustom: false,
});
const timers = ref<TimerState>({ global: null, sites: {} });
const nowMs = ref(Date.now());
let tickTimer: any;

const valid = computed(() => Boolean(host.value));
const siteTimer = computed(() => (valid.value ? timers.value.sites?.[host.value] || null : null));
const globalTimer = computed(() => timers.value.global || null);
const active = computed(() => valid.value && level.value > 0 && globalMode.value > 0);
const disabled = computed(
  () =>
    busy.value ||
    !valid.value ||
    globalMode.value === 0 ||
    forbid.value.includes('filteringMode')
);
const stealthActiveCount = computed(
  () => Object.values(stealth.value).filter(Boolean).length
);

const headerStatus = computed(() => {
  if (busy.value) return { tone: 'neutral' as const, label: tr('Đang tải…', 'Loading…') };
  if (globalMode.value === 0) {
    return globalTimer.value
      ? {
          tone: 'warning' as const,
          label: formatCountdown(globalTimer.value.resumeAt, nowMs.value),
        }
      : { tone: 'neutral' as const, label: tr('Đã tắt toàn cục', 'Global pause') };
  }
  if (!valid.value) return { tone: 'neutral' as const, label: tr('Nội bộ', 'Internal') };
  if (siteTimer.value) {
    return {
      tone: 'warning' as const,
      label: formatCountdown(siteTimer.value.resumeAt, nowMs.value),
    };
  }
  if (active.value) return { tone: 'success' as const, label: tr('Đang bật', 'Protected') };
  return { tone: 'neutral' as const, label: tr('Ngoại lệ', 'Allowlisted') };
});

const heroHeading = computed(() => {
  if (busy.value) return tr('Đang kết nối engine…', 'Connecting…');
  if (globalMode.value === 0) {
    return globalTimer.value
      ? tr('Bảo vệ toàn cục đang tạm dừng', 'Global protection snoozed')
      : tr('Bảo vệ toàn cục đang tắt', 'Global protection is off');
  }
  if (!valid.value) return tr('Trang không hỗ trợ lọc', 'Page not filterable');
  if (siteTimer.value) return tr('Tạm dừng có hẹn giờ', 'Temporarily paused');
  return active.value
    ? tr('Bạn đang được bảo vệ', 'You are protected')
    : tr('Đã tạm dừng trên trang này', 'Paused on this site');
});

const quick = computed(() => [
  {
    label: tr('Tổng quan', 'Overview'),
    icon: LayoutDashboard,
    action: () => go('overview'),
    disabled: forbid.value.includes('dashboard'),
  },
  {
    label: tr('Bộ lọc', 'Filters'),
    icon: ListFilter,
    action: () => go('filters'),
    disabled: forbid.value.includes('dashboard'),
  },
  {
    label: tr('Riêng tư', 'Privacy'),
    icon: Fingerprint,
    action: () => go('privacy'),
    disabled: forbid.value.includes('dashboard'),
  },
  {
    label: tr('Nhật ký', 'Log'),
    icon: Activity,
    action: () => go('activity'),
    disabled: !valid.value || forbid.value.includes('dashboard'),
  },
]);

async function init() {
  busy.value = true;
  error.value = '';
  try {
    await loadPrefs();
    [tab.value] = await web.tabs.query({ active: true, currentWindow: true });
    const u = new URL(tab.value?.url || 'about:blank');
    if (/^https?:$/.test(u.protocol)) {
      host.value = u.hostname;
    } else {
      host.value = '';
    }
    const [g, ls, st, sl, tm] = await Promise.all([
      api('getDefaultFilteringMode'),
      api('getEnabledRulesets'),
      api('originGetStats'),
      api('originGetStealth'),
      api('originGetTimers'),
    ]);
    globalMode.value = g;
    lists.value = ls?.length || 0;
    if (st) stats.value = st;
    if (sl) stealth.value = sl;
    if (tm) timers.value = tm;

    if (valid.value) {
      const p = await api('popupPanelData', {
        origin: u.origin,
        hostname: host.value,
      });
      if (!p) throw Error(tr('Không kết nối được engine', 'Engine unavailable'));
      level.value = p.level;
      autoReload.value = p.autoReload;
      forbid.value = p.disabledFeatures || [];
      customCount.value = Number(p.hasCustomFilters || 0);
      last.value = level.value || g || 2;
      try {
        const s = await web.storage.session.get('origin.lastSiteMode');
        if (s['origin.lastSiteMode']?.hostname === host.value) {
          last.value = s['origin.lastSiteMode'].level;
        }
      } catch {}
      try {
        const b = await web.action.getBadgeText({ tabId: tab.value.id });
        if (/^\d+$/.test(b)) {
          count.value = Number(b);
          await api('originObserve', { count: count.value, tabId: tab.value.id });
          const freshStats = await api('originGetStats');
          if (freshStats) stats.value = freshStats;
        }
      } catch {}
      if (count.value === null) {
        try {
          const m = await web.declarativeNetRequest.getMatchedRules({ tabId: tab.value.id });
          count.value = m.rulesMatchedInfo?.length || 0;
        } catch {}
      }
    }
  } catch (e: any) {
    error.value = e.message || String(e);
  } finally {
    busy.value = false;
  }
}

async function change(n: number) {
  if (disabled.value || n === level.value) return;
  busy.value = true;
  error.value = '';
  const old = level.value;
  try {
    if (n > 1 && !(await web.permissions.contains({ origins: ['*://*.' + host.value + '/*'] }))) {
      if (!(await web.permissions.request({ origins: ['*://*.' + host.value + '/*'] }))) {
        throw Error(tr('Chưa cấp quyền website', 'Site permission not granted'));
      }
    }
    const actual = await api<number>('setFilteringMode', {
      hostname: host.value,
      level: n,
    });
    if (actual !== n) {
      throw Error(tr('Không thể đổi mức bảo vệ', 'Could not change protection'));
    }
    level.value = actual;
    if (n === 0 && old > 0) {
      last.value = old;
      await web.storage.session.set({
        'origin.lastSiteMode': { hostname: host.value, level: old },
      });
    }
    if (n > 0) last.value = n;
    timers.value = await api('originGetTimers');
    if (autoReload.value && tab.value?.id) {
      await web.tabs.reload(tab.value.id);
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function pauseSiteFor(minutes: number) {
  if (disabled.value || !valid.value) return;
  busy.value = true;
  error.value = '';
  try {
    timers.value = await api('originTimedPause', {
      scope: 'site',
      hostname: host.value,
      minutes,
    });
    level.value = await api('getFilteringMode', { hostname: host.value });
    if (autoReload.value && tab.value?.id) {
      await web.tabs.reload(tab.value.id);
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function resumeSiteTimer() {
  if (busy.value || !valid.value) return;
  busy.value = true;
  error.value = '';
  try {
    timers.value = await api('originCancelTimer', {
      scope: 'site',
      hostname: host.value,
    });
    level.value = await api('getFilteringMode', { hostname: host.value });
    if (autoReload.value && tab.value?.id) {
      await web.tabs.reload(tab.value.id);
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function resumeGlobal() {
  if (busy.value || forbid.value.includes('filteringMode')) return;
  busy.value = true;
  error.value = '';
  try {
    globalMode.value = await api('originGlobalToggle', { enabled: true });
    timers.value = await api('originGetTimers');
    if (valid.value) {
      level.value = await api('getFilteringMode', { hostname: host.value });
      if (autoReload.value && tab.value?.id) {
        await web.tabs.reload(tab.value.id);
      }
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function reloadCurrentTab() {
  if (tab.value?.id) {
    await web.tabs.reload(tab.value.id);
    window.close();
  }
}

async function go(p: string) {
  try {
    if (p === 'activity' && valid.value) {
      await snapshot(tab.value.id, host.value);
    }
    await navigate(p);
    window.close();
  } catch (e: any) {
    error.value = e.message;
  }
}

async function pick(kind: string) {
  if (!active.value) return;
  const files =
    kind === 'zapper'
      ? ['/js/scripting/tool-overlay.js', '/js/scripting/zapper.js']
      : [
          '/js/scripting/css-procedural-api.js',
          '/js/scripting/tool-overlay.js',
          '/js/scripting/' + kind + '.js',
        ];
  try {
    await web.scripting.executeScript({ files, target: { tabId: tab.value.id } });
    window.close();
  } catch (e: any) {
    error.value = e.message;
  }
}

async function report() {
  await web.tabs.create({ url: 'https://github.com/lowji194/Origin-uBlock/issues/new' });
  window.close();
}

onMounted(() => {
  void init();
  tickTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  clearInterval(tickTimer);
});
</script>

<template>
  <main class="popup-shell">
    <header class="popup-header">
      <div class="brand">
        <BrandLogo :size="20" />
        <div>
          <div class="brand-title">
            <b>Origin uBlock</b>
          </div>
          <small>{{ tr('Chặn quảng cáo & bảo mật', 'Ad blocking & privacy') }}</small>
        </div>
      </div>
      <div class="popup-header-actions">
        <StatusPill :tone="headerStatus.tone" :label="headerStatus.label" />
        <button
          v-if="valid"
          type="button"
          class="icon-button"
          :title="tr('Tải lại trang này', 'Reload this page')"
          :aria-label="tr('Tải lại trang này', 'Reload this page')"
          @click="reloadCurrentTab"
        >
          <RotateCw :size="16" />
        </button>
        <button
          type="button"
          class="icon-button"
          :title="tr('Mở Trung tâm bảo vệ', 'Open Protection Center')"
          :aria-label="tr('Mở Trung tâm bảo vệ', 'Open Protection Center')"
          :disabled="forbid.includes('dashboard')"
          @click="go('settings')"
        >
          <Settings :size="17" />
        </button>
      </div>
    </header>

    <div v-if="error" class="notice danger">
      <AlertCircle :size="16" />
      <span>{{ error }}</span>
      <button type="button" :aria-label="tr('Thử lại', 'Retry')" @click="init">
        <RotateCw :size="14" />
      </button>
    </div>

    <div v-if="globalMode === 0 && !busy" class="notice warning">
      <AlertCircle :size="16" />
      <span>
        {{
          globalTimer
            ? tr('Đang tạm dừng toàn cục · còn ', 'Global pause · ') +
              formatCountdown(globalTimer.resumeAt, nowMs)
            : tr('Bảo vệ toàn cục đang tắt.', 'Global protection is turned off.')
        }}
      </span>
      <button
        type="button"
        class="btn compact primary"
        :disabled="forbid.includes('filteringMode')"
        @click="resumeGlobal"
      >
        {{ tr('Bật lại', 'Resume') }}
      </button>
    </div>

    <section class="popup-site-card">
      <div class="popup-site-top">
        <div
          class="popup-site-info popup-hero"
          :class="{ paused: !active && !siteTimer, timed: Boolean(siteTimer) }"
        >
          <h1>{{ heroHeading }}</h1>
          <div class="popup-host-row">
            <span class="status-dot" :class="{ active, timed: Boolean(siteTimer) }" />
            <Globe :size="13" style="flex: none; color: var(--muted)" />
            <span class="host">{{ host || tr('Trang nội bộ trình duyệt', 'Browser internal page') }}</span>
          </div>
        </div>
        <div class="power-halo" :class="{ active, timed: Boolean(siteTimer) }">
          <button
            type="button"
            class="power-button"
            :aria-pressed="active"
            :aria-label="tr('Bật hoặc tắt bảo vệ trên trang này', 'Toggle site protection')"
            :disabled="disabled"
            @click="siteTimer ? resumeSiteTimer() : change(active ? 0 : last)"
          >
            <Power :size="21" :stroke-width="2.4" />
          </button>
        </div>
      </div>

      <div v-if="valid && globalMode > 0" class="popup-snooze-row">
        <template v-if="siteTimer">
          <span class="small">
            <Clock :size="12" style="display: inline; vertical-align: -2px" />
            {{ tr('Tự bật lại sau', 'Resumes in') }}
            <b>{{ formatCountdown(siteTimer.resumeAt, nowMs) }}</b>
          </span>
          <button type="button" class="snooze-pill" :disabled="disabled" @click="resumeSiteTimer">
            {{ tr('Bật ngay', 'Resume now') }}
          </button>
        </template>
        <template v-else-if="active">
          <span class="small">{{ tr('Tạm dừng:', 'Pause:') }}</span>
          <div class="snooze-pills">
            <button type="button" class="snooze-pill" :disabled="disabled" @click="pauseSiteFor(5)">
              {{ tr('5 phút', '5m') }}
            </button>
            <button type="button" class="snooze-pill" :disabled="disabled" @click="pauseSiteFor(30)">
              {{ tr('30 phút', '30m') }}
            </button>
          </div>
          <StatusPill
            v-if="stealthActiveCount > 0"
            tone="info"
            :label="`Stealth (${stealthActiveCount})`"
          />
        </template>
        <template v-else>
          <span class="small">{{ tr('Trang này đang ở danh sách ngoại lệ', 'Site is allowlisted') }}</span>
          <button type="button" class="snooze-pill" :disabled="disabled" @click="change(last)">
            {{ tr('Bật bảo vệ', 'Enable') }}
          </button>
        </template>
      </div>
    </section>

    <div class="popup-metrics">
      <article :class="{ blocked: (count || 0) > 0 }">
        <div class="metric-head">
          <span>{{ tr('Đã chặn trên trang', 'Blocked on page') }}</span>
          <ShieldBan :size="14" style="color: var(--tone-danger-ink)" />
        </div>
        <strong>{{ count === null ? '—' : num(count) }}</strong>
      </article>
      <article>
        <div class="metric-head">
          <span>
            {{
              stats.enabled
                ? tr('Tổng đã quan sát', 'Total observed')
                : tr('Bộ lọc hoạt động', 'Active filter lists')
            }}
          </span>
          <SlidersHorizontal :size="14" style="color: var(--accent)" />
        </div>
        <strong>{{ stats.enabled ? num(stats.total || 0) : num(lists) }}</strong>
      </article>
    </div>

    <div class="popup-block-card">
      <div class="level-head">
        <span>{{ tr('Mức độ bảo vệ', 'Protection level') }}</span>
        <span class="small">{{ modeName(level) }} · {{ lists }} {{ tr('bộ lọc', 'lists') }}</span>
      </div>
      <div class="segmented">
        <button
          v-for="m in protectionModes"
          :key="m.id"
          type="button"
          :class="{ selected: level === m.id && active }"
          :disabled="disabled"
          :title="m.desc"
          @click="change(m.id)"
        >
          {{ m.name }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="popup-primary-action"
      :disabled="!active || forbid.includes('picker')"
      @click="pick('picker')"
    >
      <Crosshair :size="19" :stroke-width="2.1" />
      <div>
        <b>{{ tr('Chặn phần tử trên trang', 'Block element on page') }}</b>
        <small>{{ tr('Chọn vùng quảng cáo để ẩn vĩnh viễn', 'Select an ad area to hide permanently') }}</small>
      </div>
      <ChevronRight :size="16" />
    </button>

    <div class="popup-action-grid">
      <button
        type="button"
        class="popup-action-btn"
        :disabled="!active || forbid.includes('zapper')"
        @click="pick('zapper')"
      >
        <EyeOff :size="16" />
        <span>{{ tr('Ẩn tạm thời', 'Zap element') }}</span>
      </button>
      <button
        type="button"
        class="popup-action-btn"
        :disabled="!active || forbid.includes('picker')"
        @click="pick('unpicker')"
      >
        <span v-if="customCount > 0" class="popup-action-badge">{{ customCount }}</span>
        <RotateCcw :size="16" />
        <span>{{ tr('Khôi phục', 'Unhide') }}</span>
      </button>
      <button type="button" class="popup-action-btn" @click="report">
        <Flag :size="16" />
        <span>{{ tr('Báo lỗi', 'Report') }}</span>
      </button>
    </div>

    <nav class="quick-nav">
      <button
        v-for="item in quick"
        :key="item.label"
        type="button"
        :disabled="item.disabled"
        @click="item.action"
      >
        <component :is="item.icon" :size="17" :stroke-width="1.9" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <SiteFooter compact />
  </main>
</template>
