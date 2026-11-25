<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Shield,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Cpu,
  Eye,
} from 'lucide-vue-next';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import StatusPill from '../components/StatusPill.vue';
import {
  tr,
  protectionModes,
  theme,
  language,
  num,
  api,
} from '../api';
import type { StatsData, DnrDiagnostics, ThemePref } from '../types';

const props = defineProps<{
  config: any;
  stats: StatsData;
  diagnostics: DnrDiagnostics | null;
  modeRestricted: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'levelChange', n: number): void;
  (e: 'changeSetting', msg: string, current: boolean): void;
  (e: 'toggleDeveloper'): void;
  (e: 'toggleStats'): void;
  (e: 'prefsChange'): void;
  (e: 'exportSettings'): void;
  (e: 'restoreSettings', event: Event): void;
  (e: 'clearStats'): void;
  (e: 'reset'): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const dynamicRulesPreview = ref<any[] | null>(null);
const loadingDnr = ref(false);

const settingRows = computed(() => [
  {
    key: 'autoReload',
    msg: 'setAutoReload',
    name: tr('Tự tải lại trang', 'Automatically reload pages'),
    desc: tr('Tự làm mới tab sau khi bạn đổi bảo vệ cho website.', 'Reload current tab after changing site protection.'),
    disabled: false,
  },
  {
    key: 'showBlockedCount',
    msg: 'setShowBlockedCount',
    name: tr('Hiện số lượt lọc trên biểu tượng', 'Show filter count on icon'),
    desc: tr('Hiển thị số lượng yêu cầu khớp DNR trên huy hiệu tiện ích.', 'Display matched DNR action count on the toolbar badge.'),
    disabled: !props.config.canShowBlockedCount,
  },
  {
    key: 'strictBlockMode',
    msg: 'setStrictBlockMode',
    name: tr('Chặn trang nguy hiểm (Strict Blocking)', 'Strict blocking warnings'),
    desc: tr('Hiển thị trang cảnh báo trước khi truy cập liên kết khớp bộ lọc mã độc.', 'Show warning interstitial before navigating to risky domains.'),
    disabled: !props.config.hasOmnipotence,
  },
  {
    key: 'popupBlockMode',
    msg: 'setPopupBlockMode',
    name: tr('Chặn cửa sổ bật lên (Pop-ups)', 'Block pop-up windows'),
    desc: tr('Ngăn cửa sổ bật lên và tab quảng cáo không mong muốn.', 'Prevent unwanted pop-up windows.'),
    disabled: false,
  },
]);

const themeChoices = computed(() => [
  { id: 'light' as ThemePref, label: tr('Sáng', 'Light'), icon: Sun },
  { id: 'dark' as ThemePref, label: tr('Tối', 'Dark'), icon: Moon },
  { id: 'system' as ThemePref, label: tr('Hệ thống', 'System'), icon: Monitor },
]);

function setTheme(id: ThemePref) {
  theme.value = id;
  emit('prefsChange');
}

async function loadDynamicRulesPreview() {
  loadingDnr.value = true;
  try {
    const res = await api('getAllDynamicRules');
    dynamicRulesPreview.value = Array.isArray(res) ? res.slice(0, 60) : [];
  } finally {
    loadingDnr.value = false;
  }
}
</script>

<template>
  <section class="stack" data-page="settings">
    <article class="panel">
      <h2>{{ tr('Mức bảo vệ mặc định', 'Default protection level') }}</h2>
      <p class="subtext">
        {{ tr('Chọn mức lọc áp dụng cho mọi website không nằm trong danh sách ngoại lệ.', 'Choose filtering applied to websites without exceptions.') }}
      </p>
      <div class="mode-cards">
        <button
          v-for="m in protectionModes"
          :key="m.id"
          type="button"
          :class="{ selected: config.defaultFilteringMode === m.id }"
          :disabled="busy || modeRestricted"
          @click="$emit('levelChange', m.id)"
        >
          <Shield :size="22" />
          <div style="display: flex; align-items: center; gap: 8px">
            <b>{{ m.name }}</b>
            <StatusPill v-if="m.id === 2" tone="success" :label="m.short" hide-icon />
          </div>
          <small>{{ m.desc }}</small>
          <CheckCircle2 v-if="config.defaultFilteringMode === m.id" :size="17" class="mode-check" />
        </button>
      </div>
    </article>

    <article class="panel">
      <h2>{{ tr('Hành vi bảo vệ', 'Protection behavior') }}</h2>
      <div v-for="s in settingRows" :key="s.key" class="list-row">
        <div class="list-details">
          <b>{{ s.name }}</b>
          <small>{{ s.desc }}</small>
        </div>
        <ToggleSwitch
          :checked="Boolean(config[s.key])"
          :disabled="busy || s.disabled"
          :label="s.name"
          @toggle="$emit('changeSetting', s.msg, Boolean(config[s.key]))"
        />
      </div>
      <div class="list-row">
        <div class="list-details">
          <div class="list-title-wrap">
            <b>{{ tr('Chế độ nhà phát triển (DNR Inspector)', 'Developer mode (DNR Inspector)') }}</b>
            <StatusPill tone="scheduled" label="MV3" hide-icon />
          </div>
          <small>
            {{
              tr(
                'Cho phép xem quy tắc DNR động đang thực thi và chẩn đoán engine sâu hơn.',
                'Enables live dynamic DNR rule inspection and deeper engine diagnostics.'
              )
            }}
          </small>
        </div>
        <ToggleSwitch
          :checked="Boolean(config.developerMode)"
          :disabled="busy || config.disabledFeatures?.includes('develop')"
          :label="tr('Chế độ nhà phát triển', 'Developer mode')"
          @toggle="$emit('toggleDeveloper')"
        />
      </div>
    </article>

    <article class="panel">
      <h2>{{ tr('Giao diện và ngôn ngữ', 'Appearance and language') }}</h2>
      <div class="list-row">
        <div class="list-details">
          <b>{{ tr('Chủ đề hiển thị', 'Theme') }}</b>
          <small>{{ tr('Chọn giao diện sáng, tối hoặc theo hệ điều hành', 'Choose light, dark or system appearance') }}</small>
        </div>
        <div class="theme-options">
          <button
            v-for="opt in themeChoices"
            :key="opt.id"
            type="button"
            :class="{ selected: theme === opt.id }"
            :title="opt.id"
            @click="setTheme(opt.id)"
          >
            <component :is="opt.icon" :size="16" />
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </div>

      <div class="list-row">
        <div class="list-details">
          <b>{{ tr('Ngôn ngữ', 'Language') }}</b>
          <small>{{ tr('Áp dụng ngay cho popup và trung tâm bảo vệ', 'Applied immediately to popup and dashboard') }}</small>
        </div>
        <select v-model="language" class="field compact" @change="$emit('prefsChange')">
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>
    </article>

    <article class="panel">
      <h2>{{ tr('Dữ liệu và sao lưu', 'Data and backup') }}</h2>
      <div class="list-row">
        <div class="list-details">
          <b>{{ tr('Thống kê cục bộ', 'Local statistics') }}</b>
          <small>{{ tr('Tùy chọn, không lưu URL, không gửi dữ liệu ra ngoài.', 'Optional, no URLs stored or sent to servers.') }}</small>
        </div>
        <ToggleSwitch
          :checked="stats.enabled"
          :disabled="busy"
          :label="tr('Thống kê cục bộ', 'Local statistics')"
          @toggle="$emit('toggleStats')"
        />
      </div>
      <div class="form-row wrap">
        <button type="button" class="btn secondary" :disabled="busy" @click="$emit('exportSettings')">
          <Download :size="15" />
          {{ tr('Sao lưu JSON', 'Backup JSON') }}
        </button>
        <button type="button" class="btn secondary" :disabled="busy" @click="fileInput?.click()">
          <Upload :size="15" />
          {{ tr('Khôi phục JSON', 'Restore JSON') }}
        </button>
        <button type="button" class="btn secondary" :disabled="busy" @click="$emit('clearStats')">
          <Trash2 :size="15" />
          {{ tr('Xóa thống kê', 'Clear stats') }}
        </button>
        <button type="button" class="btn danger" :disabled="busy" @click="$emit('reset')">
          <RotateCcw :size="15" />
          {{ tr('Đặt lại mặc định', 'Reset defaults') }}
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          hidden
          @change="$emit('restoreSettings', $event)"
        />
      </div>
    </article>

    <article v-if="diagnostics" class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Chẩn đoán Engine MV3', 'MV3 Engine Diagnostics') }}</h2>
          <p>{{ tr('Thông số thực tế từ API declarativeNetRequest của trình duyệt.', 'Live metrics from Chromium declarativeNetRequest APIs.') }}</p>
        </div>
        <button
          v-if="config.developerMode"
          type="button"
          class="btn secondary compact"
          :disabled="loadingDnr"
          @click="loadDynamicRulesPreview"
        >
          <Eye :size="14" />
          {{ tr('Xem Dynamic Rules', 'Inspect Dynamic Rules') }}
        </button>
      </div>

      <div class="stat-grid">
        <article class="stat-card">
          <div class="stat-card-top">
            <span>{{ tr('Bộ lọc tĩnh bật', 'Static rulesets') }}</span>
            <Cpu :size="15" />
          </div>
          <strong>{{ diagnostics.enabledRulesetsCount }} / {{ diagnostics.maxStaticRulesets }}</strong>
        </article>
        <article class="stat-card">
          <div class="stat-card-top">
            <span>{{ tr('Static rule còn lại', 'Remaining static rules') }}</span>
            <Cpu :size="15" />
          </div>
          <strong>
            {{ diagnostics.availableStaticRuleCount === null ? '—' : num(diagnostics.availableStaticRuleCount) }}
          </strong>
        </article>
        <article class="stat-card">
          <div class="stat-card-top">
            <span>{{ tr('Dynamic / Stealth', 'Dynamic / Stealth') }}</span>
            <Cpu :size="15" />
          </div>
          <strong>{{ diagnostics.dynamicRulesCount }} / {{ diagnostics.stealthRulesCount }}</strong>
        </article>
        <article class="stat-card">
          <div class="stat-card-top">
            <span>{{ tr('Session / User DNR', 'Session / User DNR') }}</span>
            <Cpu :size="15" />
          </div>
          <strong>{{ diagnostics.sessionRulesCount }} / {{ diagnostics.userRulesCount }}</strong>
        </article>
      </div>

      <div v-if="dynamicRulesPreview" class="rule-inspector-box">
        <div class="picked-head">
          <b>{{ tr('Quy tắc DNR động hiện hành (tối đa 60 mục đầu)', 'Active Dynamic DNR rules (first 60)') }}</b>
          <button type="button" class="btn secondary compact" @click="dynamicRulesPreview = null">
            {{ tr('Ẩn', 'Hide') }}
          </button>
        </div>
        <pre>{{ JSON.stringify(dynamicRulesPreview, null, 2) }}</pre>
      </div>
    </article>
  </section>
</template>
