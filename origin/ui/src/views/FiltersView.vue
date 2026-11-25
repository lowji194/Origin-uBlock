<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Search,
  RefreshCw,
  ListFilter,
  Globe,
  ExternalLink,
  Trash2,
  Plus,
  Sparkles,
  Shield,
  Zap,
  AlertTriangle,
  Settings,
} from 'lucide-vue-next';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import StatusPill from '../components/StatusPill.vue';
import { tr, num, groupMeta, parseRulesetDisplay, web } from '../api';
import type { RulesetDetail } from '../types';

const props = defineProps<{
  listData: RulesetDetail[];
  enabledSet: Set<string>;
  ruleCount: number;
  maxRulesets: number;
  adminRulesets: string[];
  supportsUserScripts: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleList', r: RulesetDetail): void;
  (e: 'addList', url: string): void;
  (e: 'removeList', id: string): void;
  (e: 'updateLists'): void;
  (e: 'refresh'): void;
  (e: 'applyPreset', preset: 'balanced' | 'adguard' | 'max'): void;
}>();

const query = ref('');
const group = ref('all');
const onlyEnabled = ref(false);
const importUrl = ref('');
const brokenFlags = ref<Record<string, boolean>>({});

const groups = computed(() => [
  { id: 'all', name: tr('Tất cả', 'All') },
  { id: 'default', name: tr('Cơ bản', 'Essential') },
  { id: 'ads', name: tr('Quảng cáo', 'Ads') },
  { id: 'privacy', name: tr('Riêng tư', 'Privacy') },
  { id: 'annoyances', name: tr('Phiền nhiễu', 'Annoyances') },
  { id: 'malware', name: tr('An toàn', 'Security') },
  { id: 'regions', name: tr('Việt Nam & Khu vực', 'Vietnam & Regional') },
  { id: 'imported', name: tr('Tùy chỉnh', 'Custom') },
]);

async function openExtensionSettings() {
  try {
    await web.tabs.create({ url: `chrome://extensions/?id=${web.runtime.id}` });
  } catch {
    // Fallback if browser restricts chrome:// URL opening
  }
}

const category = (r: RulesetDetail) => r.group || 'other';

const adminList = (id: string) =>
  (props.adminRulesets || []).some((a) => [id, '+' + id, '-' + id].includes(a));

const staticEnabledCount = computed(
  () =>
    props.listData.filter(
      (r) => r.group !== 'imported' && props.enabledSet.has(r.id)
    ).length
);

const quotaPct = computed(() =>
  Math.min(100, Math.round((staticEnabledCount.value / Math.max(1, props.maxRulesets || 50)) * 100))
);

const visibleLists = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.listData
    .filter((r) => {
      if (group.value !== 'all' && category(r) !== group.value) return false;
      if (onlyEnabled.value && !props.enabledSet.has(r.id)) return false;
      if (!q) return true;
      const hay = `${r.name} ${r.id} ${r.tags || ''} ${r.lang || ''}`.toLowerCase();
      return hay.includes(q);
    })
    .sort(
      (a, b) =>
        Number(props.enabledSet.has(b.id)) - Number(props.enabledSet.has(a.id)) ||
        parseRulesetDisplay(a).title.localeCompare(parseRulesetDisplay(b).title)
    );
});

function submitImport() {
  if (!importUrl.value.trim()) return;
  emit('addList', importUrl.value.trim());
  importUrl.value = '';
}
</script>

<template>
  <section class="stack" data-page="filters">
    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Danh sách bộ lọc', 'Filter lists') }}</h2>
          <p>
            {{ enabledSet.size }} {{ tr('đang bật', 'enabled') }} ·
            {{ num(ruleCount) }} {{ tr('quy tắc mạng', 'network rules') }} ·
            {{ tr('Không có quảng cáo tài trợ (Zero Acceptable Ads)', 'Zero Acceptable Ads') }}
          </p>
        </div>
        <div class="form-row wrap" style="margin-top: 0">
          <button type="button" class="btn secondary compact" :disabled="busy" @click="$emit('applyPreset', 'balanced')">
            <Shield :size="14" />
            {{ tr('Chuẩn', 'Balanced') }}
          </button>
          <button type="button" class="btn secondary compact" :disabled="busy" @click="$emit('applyPreset', 'adguard')">
            <Sparkles :size="14" />
            {{ tr('Sạch + Stealth', 'Clean + Stealth') }}
          </button>
          <button type="button" class="btn secondary compact" :disabled="busy" @click="$emit('applyPreset', 'max')">
            <Zap :size="14" />
            {{ tr('Tối đa', 'Max') }}
          </button>
          <button type="button" class="btn secondary compact" :disabled="busy" @click="$emit('updateLists')">
            <RefreshCw :size="14" />
            {{ tr('Cập nhật tùy chỉnh', 'Update custom') }}
          </button>
        </div>
      </div>

      <div style="margin-bottom: 12px">
        <div class="level-head" style="font-size: 12px">
          <span class="small">
            {{ tr('Dung lượng bộ lọc tĩnh MV3:', 'MV3 static rulesets capacity:') }}
            <b>{{ staticEnabledCount }} / {{ maxRulesets || 50 }}</b>
          </span>
          <span class="small">{{ quotaPct }}%</span>
        </div>
        <div class="quota-bar">
          <div class="quota-fill" :class="{ warn: quotaPct >= 85 }" :style="{ width: quotaPct + '%' }" />
        </div>
      </div>

      <div class="filter-toolbar">
        <label class="search-field">
          <Search :size="17" />
          <input
            v-model="query"
            :placeholder="tr('Tìm theo tên, ngôn ngữ hoặc mã bộ lọc…', 'Search by name, language or ID…')"
          />
        </label>
        <label class="check">
          <input v-model="onlyEnabled" type="checkbox" />
          <span>{{ tr('Chỉ đang bật', 'Enabled only') }}</span>
        </label>
      </div>

      <div class="chips">
        <button
          v-for="g in groups"
          :key="g.id"
          type="button"
          :class="{ selected: group === g.id }"
          @click="group = g.id"
        >
          {{ g.name }}
        </button>
      </div>

      <div v-if="!visibleLists.length" class="empty">
        <ListFilter :size="28" />
        <span>{{ tr('Không tìm thấy bộ lọc phù hợp', 'No matching filter lists found') }}</span>
      </div>

      <div v-for="r in visibleLists" :key="r.id" class="list-row">
        <span class="list-icon">
          <img
            v-if="parseRulesetDisplay(r).flagCode && !brokenFlags[r.id]"
            class="flag-img"
            :src="`/img/flags-of-the-world/${parseRulesetDisplay(r).flagCode}.png`"
            :alt="parseRulesetDisplay(r).flagCode"
            @error="brokenFlags[r.id] = true"
          />
          <Globe v-else-if="category(r) === 'regions'" :size="18" />
          <ListFilter v-else :size="18" />
        </span>

        <div class="list-details">
          <div class="list-title-wrap">
            <b>{{ parseRulesetDisplay(r).title }}</b>
            <StatusPill
              :tone="(groupMeta[category(r) as keyof typeof groupMeta] || groupMeta.other).tone"
              :label="(groupMeta[category(r) as keyof typeof groupMeta] || groupMeta.other).name"
              hide-icon
            />
            <StatusPill
              v-if="adminList(r.id)"
              tone="neutral"
              :label="tr('Quản trị', 'Managed')"
              hide-icon
            />
          </div>
          <small>
            {{ num((r.rules?.plain || 0) + (r.rules?.regex || 0)) }} {{ tr('quy tắc mạng', 'network rules') }}
            <template v-if="r.rules?.regex">
              ({{ num(r.rules.regex) }} regex)
            </template>
            <template v-if="category(r) === 'imported' && r.time?.updated">
              · {{ tr('Cập nhật', 'Updated') }}: {{ new Date(r.time.updated).toLocaleDateString() }}
            </template>
          </small>
        </div>

        <a
          v-if="r.homeURL && /^https:\/\//.test(r.homeURL)"
          class="icon-button"
          :href="r.homeURL"
          target="_blank"
          rel="noopener noreferrer"
          :title="tr('Trang nguồn bộ lọc', 'Filter list source')"
          :aria-label="tr('Trang nguồn bộ lọc', 'Filter list source')"
        >
          <ExternalLink :size="15" />
        </a>

        <button
          v-if="category(r) === 'imported'"
          type="button"
          class="icon-button"
          :disabled="busy"
          :title="tr('Xóa bộ lọc tùy chỉnh', 'Remove custom filter')"
          :aria-label="tr('Xóa bộ lọc tùy chỉnh', 'Remove custom filter')"
          @click="$emit('removeList', r.id)"
        >
          <Trash2 :size="16" />
        </button>

        <ToggleSwitch
          :checked="enabledSet.has(r.id)"
          :disabled="busy || adminList(r.id)"
          :label="r.name"
          @toggle="$emit('toggleList', r)"
        />
      </div>
    </article>

    <form class="panel" @submit.prevent="submitImport">
      <div class="panel-header" style="margin-bottom: 8px">
        <div>
          <div class="list-title-wrap">
            <h2>{{ tr('Thêm bộ lọc tùy chỉnh (Adblock / uBlock / AdGuard)', 'Add custom filter list') }}</h2>
            <StatusPill
              :tone="supportsUserScripts ? 'success' : 'warning'"
              :label="
                supportsUserScripts
                  ? tr('Đã bật tập lệnh người dùng', 'User Scripts enabled')
                  : tr('Yêu cầu cho phép tập lệnh người dùng', 'Requires Allow User Scripts')
              "
            />
          </div>
          <p class="subtext">
            {{
              tr(
                'Nhập đường dẫn HTTPS của danh sách lọc công khai (tương thích cú pháp AdGuard, ABP và uBlock).',
                'Enter a public HTTPS filter list URL (compatible with AdGuard, ABP and uBlock syntax).'
              )
            }}
          </p>
        </div>
      </div>

      <div v-if="!supportsUserScripts" class="notice warning" style="margin-bottom: 12px">
        <AlertTriangle :size="17" style="flex: none" />
        <div style="flex: 1; min-width: 0">
          <b>{{ tr('Chưa cấp quyền "Cho phép tập lệnh người dùng"', '"Allow User Scripts" is not enabled') }}</b>
          <div>
            {{
              tr(
                'Để thực thi đầy đủ bộ lọc ẩn phần tử và scriptlet từ danh sách URL tùy chỉnh, hãy bật công tắc "Cho phép tập lệnh người dùng (Allow User Scripts)" trong chi tiết tiện ích trình duyệt.',
                'To enforce cosmetic and scriptlet filters from custom URLs, turn on "Allow User Scripts" in the extension details page.'
              )
            }}
          </div>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap">
          <button type="button" class="btn compact secondary" @click="openExtensionSettings">
            <Settings :size="13" />
            {{ tr('Mở chi tiết tiện ích', 'Open details') }}
          </button>
          <button type="button" class="btn compact secondary" :disabled="busy" @click="$emit('refresh')">
            <RefreshCw :size="13" />
            {{ tr('Kiểm tra lại', 'Re-check') }}
          </button>
        </div>
      </div>

      <div class="form-row">
        <input
          v-model="importUrl"
          type="url"
          class="field"
          required
          placeholder="https://example.com/filter.txt"
        />
        <button type="submit" class="btn primary" :disabled="busy">
          <Plus :size="16" />
          {{ tr('Thêm danh sách', 'Add list') }}
        </button>
      </div>
    </form>
  </section>
</template>
