<script setup lang="ts">
import { computed } from 'vue';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Activity,
  ListFilter,
  Globe,
  Clock,
  Fingerprint,
  Sparkles,
  Zap,
  Lock,
  ChevronRight,
} from 'lucide-vue-next';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import StatusPill from '../components/StatusPill.vue';
import { tr, modeName, num, language, formatCountdown } from '../api';
import type { StealthConfig, TimerState, StatsData, RulesetDetail } from '../types';

const props = defineProps<{
  config: any;
  stats: StatsData;
  stealth: StealthConfig;
  timers: TimerState;
  exceptions: string[];
  customSitesCount: number;
  enabledSet: Set<string>;
  listData: RulesetDetail[];
  ruleCount: number;
  protectedOn: boolean;
  modeRestricted: boolean;
  busy: boolean;
  period: number;
  nowMs: number;
}>();

const emit = defineEmits<{
  (e: 'update:period', v: number): void;
  (e: 'globalToggle'): void;
  (e: 'timedPauseGlobal', minutes: number): void;
  (e: 'cancelGlobalTimer'): void;
  (e: 'toggleStats'): void;
  (e: 'applyPreset', preset: 'balanced' | 'adguard' | 'max'): void;
  (e: 'go', pane: string): void;
}>();

const dayKey = (d: Date) => d.toLocaleDateString('en-CA');

const chart = computed(() => {
  const arr: Array<{ day: string; value: number }> = [];
  for (let i = props.period - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push({
      day: d.toLocaleDateString(language.value === 'vi' ? 'vi-VN' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
      }),
      value: props.stats.days?.[dayKey(d)] || 0,
    });
  }
  return arr;
});

const maxBar = computed(() => Math.max(1, ...chart.value.map((d) => d.value)));
const observed = computed(() => chart.value.reduce((n, d) => n + d.value, 0));
const globalTimer = computed(() => props.timers.global || null);

const stealthCount = computed(
  () => Object.values(props.stealth || {}).filter(Boolean).length
);

const annoyancesCount = computed(
  () =>
    props.listData.filter(
      (r) => r.group === 'annoyances' && props.enabledSet.has(r.id)
    ).length
);

const securityActive = computed(
  () =>
    props.enabledSet.has('ublock-badware') ||
    props.enabledSet.has('urlhaus-full') ||
    Boolean(props.config.strictBlockMode)
);

const privacyActive = computed(
  () =>
    props.enabledSet.has('adguard-tracking') ||
    props.enabledSet.has('adguard-dns') ||
    props.enabledSet.has('easyprivacy') ||
    props.enabledSet.has('adguard-spyware-url') ||
    stealthCount.value > 0
);
</script>

<template>
  <section class="stack" data-page="overview">
    <div
      class="protection-banner"
      :class="{ off: !protectedOn && !globalTimer, timed: Boolean(globalTimer) }"
    >
      <span class="banner-icon">
        <Clock v-if="globalTimer" :size="28" />
        <ShieldCheck v-else-if="protectedOn" :size="30" />
        <ShieldAlert v-else :size="30" />
      </span>
      <div class="banner-copy">
        <h2>
          {{
            globalTimer
              ? tr('Đang tạm dừng có hẹn giờ', 'Timed pause active')
              : protectedOn
                ? tr('Hệ thống đang hoạt động', 'Protection is active')
                : tr('Bảo vệ đang tạm dừng', 'Protection is paused')
          }}
        </h2>
        <p>
          <template v-if="globalTimer">
            {{ tr('Tự động bật lại sau', 'Resumes automatically in') }}
            <b>{{ formatCountdown(globalTimer.resumeAt, nowMs) }}</b>
          </template>
          <template v-else>
            {{ tr('Chặn quảng cáo và bảo vệ quyền riêng tư', 'Ad blocking and privacy protection') }}
            · {{ modeName(config.defaultFilteringMode) }} ·
            {{
              stealthCount > 0
                ? tr(`Stealth ${stealthCount} lớp`, `${stealthCount} Stealth layers`)
                : tr('Chuẩn MV3', 'MV3 standard')
            }}
          </template>
        </p>
      </div>
      <div class="banner-controls">
        <template v-if="protectedOn">
          <button
            type="button"
            class="banner-ghost-btn"
            :disabled="busy || modeRestricted"
            @click="$emit('timedPauseGlobal', 15)"
          >
            <Clock :size="14" />
            {{ tr('Tạm dừng 15p', 'Snooze 15m') }}
          </button>
          <button
            type="button"
            class="banner-ghost-btn"
            :disabled="busy || modeRestricted"
            @click="$emit('timedPauseGlobal', 30)"
          >
            {{ tr('30p', '30m') }}
          </button>
        </template>
        <button
          v-else-if="globalTimer"
          type="button"
          class="banner-ghost-btn"
          :disabled="busy || modeRestricted"
          @click="$emit('cancelGlobalTimer')"
        >
          {{ tr('Bật lại ngay', 'Resume now') }}
        </button>
        <ToggleSwitch
          :checked="protectedOn"
          :disabled="busy || modeRestricted"
          :label="tr('Bảo vệ toàn cục', 'Global protection')"
          banner
          @toggle="$emit('globalToggle')"
        />
      </div>
    </div>

    <div class="stat-grid">
      <article class="stat-card">
        <div class="stat-card-top">
          <span>{{ tr('Lượt lọc quan sát', 'Observed actions') }}</span>
          <span class="stat-icon-box danger"><Activity :size="17" /></span>
        </div>
        <strong>{{ stats.enabled ? num(observed) : '—' }}</strong>
        <small>
          {{ tr('Trong', 'Over') }} {{ period }} {{ tr('ngày', 'days') }}
          <template v-if="stats.enabled && stats.total">
            · {{ tr('Tổng', 'Total') }} {{ num(stats.total) }}
          </template>
        </small>
      </article>

      <article class="stat-card">
        <div class="stat-card-top">
          <span>{{ tr('Quy tắc mạng hoạt động', 'Active network rules') }}</span>
          <span class="stat-icon-box"><Shield :size="17" /></span>
        </div>
        <strong>{{ num(ruleCount) }}</strong>
        <small>{{ tr('Quy tắc DNR đã biên dịch', 'Compiled DNR rules') }}</small>
      </article>

      <article class="stat-card">
        <div class="stat-card-top">
          <span>{{ tr('Bộ lọc hoạt động', 'Active filter lists') }}</span>
          <span class="stat-icon-box info"><ListFilter :size="17" /></span>
        </div>
        <strong>{{ enabledSet.size }} / {{ config.maxNumberOfEnabledRulesets || 50 }}</strong>
        <small>{{ tr('Giới hạn tĩnh Chrome MV3', 'Chrome MV3 static limit') }}</small>
      </article>

      <article class="stat-card">
        <div class="stat-card-top">
          <span>{{ tr('Ngoại lệ & Phần tử ẩn', 'Allowlist & Hidden') }}</span>
          <span class="stat-icon-box warning"><Globe :size="17" /></span>
        </div>
        <strong>{{ num(exceptions.length) }} / {{ num(customSitesCount) }}</strong>
        <small>{{ tr('Trang cho phép / Trang tùy biến', 'Allowlisted / Custom sites') }}</small>
      </article>
    </div>

    <article class="panel chart-panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Hoạt động lọc theo ngày', 'Daily filtering activity') }}</h2>
          <p>
            {{
              tr(
                'Số liệu quan sát cục bộ từ biểu tượng trình duyệt, không thu thập URL.',
                'Local counts observed from the browser badge, without collecting URLs.'
              )
            }}
          </p>
        </div>
        <select
          :value="period"
          class="field compact"
          :aria-label="tr('Khoảng thời gian biểu đồ', 'Chart period')"
          @change="$emit('update:period', Number(($event.target as HTMLSelectElement).value))"
        >
          <option :value="7">7 {{ tr('ngày', 'days') }}</option>
          <option :value="30">30 {{ tr('ngày', 'days') }}</option>
        </select>
      </div>
      <div class="chart" :class="{ dense: period === 30 }">
        <div v-for="d in chart" :key="d.day" class="chart-col">
          <span v-if="period === 7">{{ stats.enabled ? num(d.value) : '—' }}</span>
          <div
            class="bar"
            :class="{ 'empty-bar': !stats.enabled || d.value === 0 }"
            :title="d.day + ': ' + d.value"
            :style="{ height: (stats.enabled && d.value > 0 ? Math.max(4, (d.value / maxBar) * 140) : 2) + 'px' }"
          />
          <small>{{ period === 7 ? d.day : d.day.split(' ').at(-1) }}</small>
        </div>
      </div>
      <div class="panel-footer">
        <span>
          {{
            stats.enabled
              ? tr('Dữ liệu chỉ lưu cục bộ trên thiết bị này.', 'Data stays strictly on this device.')
              : tr('Thống kê cục bộ đang tắt.', 'Local statistics are disabled.')
          }}
        </span>
        <button type="button" class="btn secondary compact" :disabled="busy" @click="$emit('toggleStats')">
          {{ stats.enabled ? tr('Tắt thống kê', 'Disable stats') : tr('Bật thống kê', 'Enable stats') }}
        </button>
      </div>
    </article>

    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Các lớp bảo vệ hội tụ', 'Unified protection layers') }}</h2>
          <p>
            {{
              tr(
                'Tổng hợp trạng thái giữa bộ lọc Adblock Plus, lá chắn Stealth AdGuard và công cụ uBlock MV3.',
                'Combined status of Adblock Plus lists, AdGuard Stealth shields, and uBlock MV3 engine.'
              )
            }}
          </p>
        </div>
      </div>
      <div class="layers-grid">
        <div class="layer-card">
          <span class="layer-icon success"><ListFilter :size="19" /></span>
          <div class="layer-body">
            <div class="layer-title-row">
              <b>{{ tr('Chặn quảng cáo & Việt Nam', 'Core & Vietnam Ad Blocking') }}</b>
              <StatusPill
                :tone="enabledSet.has('adguard-base') || enabledSet.has('easylist') || enabledSet.has('vie-vn-desktop') || enabledSet.has('vie-1') ? 'success' : 'neutral'"
                :label="
                  enabledSet.has('adguard-base') || enabledSet.has('easylist') || enabledSet.has('vie-vn-desktop') || enabledSet.has('vie-1')
                    ? tr('Đang bật', 'Active')
                    : tr('Đang tắt', 'Off')
                "
              />
            </div>
            <small>
              {{
                tr(
                  'AdGuard Base, EasyList, Vietnam Filter Desktop & ABPVN — không quảng cáo tài trợ.',
                  'AdGuard Base, EasyList, Vietnam Filter Desktop & ABPVN — Zero Acceptable Ads.'
                )
              }}
            </small>
            <div>
              <button type="button" class="btn secondary compact" @click="$emit('go', 'filters')">
                {{ tr('Quản lý bộ lọc', 'Manage filters') }}
                <ChevronRight :size="13" />
              </button>
            </div>
          </div>
        </div>

        <div class="layer-card">
          <span class="layer-icon info"><Fingerprint :size="19" /></span>
          <div class="layer-body">
            <div class="layer-title-row">
              <b>{{ tr('Riêng tư & Chế độ tàng hình', 'Privacy & Stealth Mode') }}</b>
              <StatusPill
                :tone="privacyActive ? 'info' : 'neutral'"
                :label="
                  stealthCount > 0
                    ? tr(`Stealth ${stealthCount}/4`, `Stealth ${stealthCount}/4`)
                    : privacyActive
                      ? tr('Đang bật', 'Active')
                      : tr('Cơ bản', 'Basic')
                "
              />
            </div>
            <small>
              {{
                tr(
                  'Xóa tham số UTM/fbclid, ẩn Referer bên thứ ba, chặn beacon theo dõi.',
                  'Strip UTM/fbclid params, hide 3rd-party Referer, block tracking beacons.'
                )
              }}
            </small>
            <div>
              <button type="button" class="btn secondary compact" @click="$emit('go', 'privacy')">
                {{ tr('Cấu hình Stealth', 'Configure Stealth') }}
                <ChevronRight :size="13" />
              </button>
            </div>
          </div>
        </div>

        <div class="layer-card">
          <span class="layer-icon warning"><Sparkles :size="19" /></span>
          <div class="layer-body">
            <div class="layer-title-row">
              <b>{{ tr('Chống phiền nhiễu & Pop-up', 'Annoyances & Pop-up Shield') }}</b>
              <StatusPill
                :tone="annoyancesCount > 0 || config.popupBlockMode ? 'warning' : 'neutral'"
                :label="
                  annoyancesCount > 0
                    ? tr(`${annoyancesCount} bộ lọc`, `${annoyancesCount} active`)
                    : config.popupBlockMode
                      ? tr('Chặn Pop-up', 'Pop-ups on')
                      : tr('Đang tắt', 'Off')
                "
              />
            </div>
            <small>
              {{
                tr(
                  'Ẩn hộp thoại Cookie, popup đăng ký nhận tin, chat nổi và thông báo đẩy.',
                  'Hide cookie banners, newsletter overlays, chat widgets and push prompts.'
                )
              }}
            </small>
            <div>
              <button type="button" class="btn secondary compact" @click="$emit('go', 'privacy')">
                {{ tr('Tùy chỉnh phiền nhiễu', 'Customize annoyances') }}
                <ChevronRight :size="13" />
              </button>
            </div>
          </div>
        </div>

        <div class="layer-card">
          <span class="layer-icon danger"><Lock :size="19" /></span>
          <div class="layer-body">
            <div class="layer-title-row">
              <b>{{ tr('An toàn duyệt web & Mã độc', 'Web Security & Anti-Malware') }}</b>
              <StatusPill
                :tone="securityActive ? 'success' : 'neutral'"
                :label="securityActive ? tr('Đang bảo vệ', 'Protected') : tr('Đang tắt', 'Off')"
              />
            </div>
            <small>
              {{
                tr(
                  'Cảnh báo trang nguy hiểm (Strict Block) và danh sách URL độc hại.',
                  'Strict blocking warnings and malicious URL protection lists.'
                )
              }}
            </small>
            <div>
              <button type="button" class="btn secondary compact" @click="$emit('go', 'settings')">
                {{ tr('Cài đặt bảo mật', 'Security settings') }}
                <ChevronRight :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>

    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Hồ sơ bảo vệ nhanh (1 chạm)', 'One-click protection presets') }}</h2>
          <p>
            {{
              tr(
                'Áp dụng nhanh tổ hợp bộ lọc và lá chắn riêng tư theo nhu cầu sử dụng của bạn.',
                'Apply curated filter lists and privacy shields in a single click.'
              )
            }}
          </p>
        </div>
      </div>
      <div class="preset-grid">
        <button
          type="button"
          class="preset-card"
          :disabled="busy"
          @click="$emit('applyPreset', 'balanced')"
        >
          <div class="preset-card-head">
            <Shield :size="20" />
            <StatusPill tone="success" :label="tr('Mặc định', 'Default')" hide-icon />
          </div>
          <b>{{ tr('Chuẩn cân bằng', 'Balanced Standard') }}</b>
          <small>
            {{
              tr(
                'ABPVN, EasyList, EasyPrivacy và bảo vệ mã độc. Tương thích tối đa mọi trang web.',
                'ABPVN, EasyList, EasyPrivacy and malware guards with maximum compatibility.'
              )
            }}
          </small>
        </button>

        <button
          type="button"
          class="preset-card"
          :disabled="busy"
          @click="$emit('applyPreset', 'adguard')"
        >
          <div class="preset-card-head">
            <Sparkles :size="20" />
            <StatusPill tone="info" :label="tr('Khuyên dùng', 'Recommended')" hide-icon />
          </div>
          <b>{{ tr('Sạch & Tàng hình', 'Clean Web + Stealth') }}</b>
          <small>
            {{
              tr(
                'Bật thêm chặn Cookie, Overlay, thông báo đẩy, xóa UTM/fbclid và chặn ping theo dõi.',
                'Adds Cookie/Overlay/Push blocking, URL tracking stripper and ping blocker.'
              )
            }}
          </small>
        </button>

        <button
          type="button"
          class="preset-card"
          :disabled="busy"
          @click="$emit('applyPreset', 'max')"
        >
          <div class="preset-card-head">
            <Zap :size="20" />
            <StatusPill tone="warning" :label="tr('Mạnh nhất', 'Maximum')" hide-icon />
          </div>
          <b>{{ tr('Lá chắn tối đa', 'Maximum Shield') }}</b>
          <small>
            {{
              tr(
                'Toàn bộ Annoyances (Social, Chat, AI), chống xâm nhập LAN và ẩn Referer bên thứ ba.',
                'All Annoyances (Social, Chat, AI), LAN intrusion shield and 3rd-party Referer removal.'
              )
            }}
          </small>
        </button>
      </div>
    </article>
  </section>
</template>
