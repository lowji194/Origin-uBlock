<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Code2,
  Upload,
  Download,
  Trash2,
  Plus,
  Search,
  Wand2,
  RotateCcw,
  Save,
  EyeOff,
  AlertTriangle,
  Settings,
} from 'lucide-vue-next';
import StatusPill from '../components/StatusPill.vue';
import { tr, download, num, web } from '../api';

const props = defineProps<{
  rules: string;
  ruleOriginal: string;
  picked: Array<[string, string[]]>;
  userRulesCount: number;
  supportsUserScripts: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:rules', val: string): void;
  (e: 'saveRules'): void;
  (e: 'revertRules'): void;
  (e: 'removePicked', hostname: string, selector: string): void;
  (e: 'removeAllPicked', hostname: string): void;
  (e: 'notify', msg: string, isError?: boolean): void;
}>();

const ruleFile = ref<HTMLInputElement | null>(null);
const builderType = ref<'block' | 'allow' | 'hide' | 'removeparam'>('block');
const builderHost = ref('');
const builderArg = ref('');
const pickedQuery = ref('');

const dirty = computed(() => props.rules !== props.ruleOriginal);
const lineCount = computed(() => props.rules.split('\n').filter(Boolean).length);

const filteredPicked = computed(() => {
  const q = pickedQuery.value.trim().toLowerCase();
  if (!q) return props.picked;
  return props.picked
    .map(([hn, sels]) => {
      if (hn.toLowerCase().includes(q)) return [hn, sels] as [string, string[]];
      const matched = sels.filter((s) => s.toLowerCase().includes(q));
      return matched.length ? ([hn, matched] as [string, string[]]) : null;
    })
    .filter((x): x is [string, string[]] => x !== null);
});

const totalSelectors = computed(() =>
  props.picked.reduce((sum, entry) => sum + (entry[1]?.length || 0), 0)
);

function insertBuiltRule() {
  const rawHost = builderHost.value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  const arg = builderArg.value.trim();
  if (!rawHost) return;

  let line = '';
  if (builderType.value === 'block') {
    line = `||${rawHost}^`;
  } else if (builderType.value === 'allow') {
    line = `@@||${rawHost}^$document`;
  } else if (builderType.value === 'hide') {
    if (!arg) return;
    line = `${rawHost}##${arg}`;
  } else if (builderType.value === 'removeparam') {
    const param = arg || 'utm_source';
    line = `||${rawHost}^$removeparam=${param}`;
  }
  if (!line) return;

  const next = props.rules ? `${props.rules.trimEnd()}\n${line}\n` : `${line}\n`;
  emit('update:rules', next);
  builderHost.value = '';
  builderArg.value = '';
}

async function importRules(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  if (f.size > 2_000_000) {
    emit('notify', tr('Tệp quá lớn (tối đa 2MB)', 'File too large (max 2MB)'), true);
    input.value = '';
    return;
  }
  const text = await f.text();
  const next = props.rules ? `${props.rules.trimEnd()}\n${text}` : text;
  emit('update:rules', next);
  input.value = '';
}

async function openExtensionSettings() {
  try {
    await web.tabs.create({ url: `chrome://extensions/?id=${web.runtime.id}` });
  } catch {}
}
</script>

<template>
  <section class="stack" data-page="rules">
    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Trình tạo quy tắc nhanh (AdGuard & ABP Syntax)', 'Quick rule builder') }}</h2>
          <p>
            {{
              tr(
                'Tạo nhanh quy tắc chặn tên miền, ngoại lệ, ẩn CSS hoặc xóa tham số theo dõi.',
                'Quickly generate domain blocks, exceptions, CSS hiding or removeparam rules.'
              )
            }}
          </p>
        </div>
        <StatusPill
          tone="info"
          :label="`${num(userRulesCount)} ${tr('quy tắc DNR đang chạy', 'active DNR rules')}`"
        />
      </div>

      <div class="form-row wrap" style="margin-top: 4px">
        <select v-model="builderType" class="field compact" :aria-label="tr('Loại quy tắc', 'Rule type')">
          <option value="block">{{ tr('Chặn tên miền (||domain^)', 'Block domain') }}</option>
          <option value="allow">{{ tr('Cho phép ngoại lệ (@@||domain^)', 'Allowlist domain') }}</option>
          <option value="hide">{{ tr('Ẩn phần tử CSS (##selector)', 'Hide element (CSS)') }}</option>
          <option value="removeparam">{{ tr('Gỡ tham số URL ($removeparam)', 'Strip query param') }}</option>
        </select>
        <input
          v-model="builderHost"
          class="field"
          :placeholder="tr('Tên miền, ví dụ: ads.example.com', 'Domain, e.g. ads.example.com')"
        />
        <input
          v-if="builderType === 'hide' || builderType === 'removeparam'"
          v-model="builderArg"
          class="field"
          :placeholder="
            builderType === 'hide'
              ? tr('CSS selector, ví dụ: .ad-banner', 'CSS selector, e.g. .ad-banner')
              : tr('Tên tham số, mặc định: utm_source', 'Query param, default: utm_source')
          "
        />
        <button
          type="button"
          class="btn secondary"
          :disabled="!builderHost.trim() || (builderType === 'hide' && !builderArg.trim())"
          @click="insertBuiltRule"
        >
          <Wand2 :size="15" />
          {{ tr('Chèn quy tắc', 'Insert rule') }}
        </button>
      </div>
    </article>

    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Quy tắc tùy chỉnh của tôi', 'My custom filter rules') }}</h2>
          <p>
            {{
              tr(
                'Mỗi quy tắc một dòng (hỗ trợ cú pháp Adblock/uBlock/AdGuard tương thích MV3). Nhấn Ctrl+S để lưu.',
                'One rule per line (MV3-compatible Adblock/uBlock/AdGuard syntax). Press Ctrl+S to save.'
              )
            }}
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px">
          <StatusPill v-if="dirty" tone="warning" :label="tr('Chưa lưu', 'Unsaved')" />
          <span class="small">{{ num(lineCount) }} {{ tr('dòng', 'lines') }}</span>
        </div>
      </div>

      <div v-if="!supportsUserScripts" class="notice warning" style="margin-bottom: 12px">
        <AlertTriangle :size="16" style="flex: none" />
        <span style="flex: 1">
          {{
            tr(
              'Lưu ý: Quy tắc ẩn CSS hoặc scriptlet tùy chỉnh cần bật "Cho phép tập lệnh người dùng (Allow User Scripts)" trong chi tiết tiện ích để hoạt động.',
              'Note: Custom cosmetic and scriptlet rules require "Allow User Scripts" in extension details.'
            )
          }}
        </span>
        <button type="button" class="btn compact secondary" @click="openExtensionSettings">
          <Settings :size="13" />
          {{ tr('Mở chi tiết tiện ích', 'Extension details') }}
        </button>
      </div>

      <textarea
        :value="rules"
        class="editor"
        spellcheck="false"
        placeholder="! Thêm quy tắc của bạn tại đây&#10;||ads.example.com^&#10;example.com##.sponsored-box&#10;||example.com^$removeparam=fbclid"
        @input="$emit('update:rules', ($event.target as HTMLTextAreaElement).value)"
        @keydown.ctrl.s.prevent="$emit('saveRules')"
        @keydown.meta.s.prevent="$emit('saveRules')"
      />

      <div class="form-row wrap">
        <button type="button" class="btn primary" :disabled="busy || !dirty" @click="$emit('saveRules')">
          <Save :size="15" />
          {{ tr('Lưu quy tắc', 'Save rules') }}
        </button>
        <button type="button" class="btn secondary" :disabled="busy || !dirty" @click="$emit('revertRules')">
          <RotateCcw :size="15" />
          {{ tr('Hoàn tác', 'Revert') }}
        </button>
        <button type="button" class="btn secondary" @click="ruleFile?.click()">
          <Upload :size="15" />
          {{ tr('Nhập .txt', 'Import .txt') }}
        </button>
        <button type="button" class="btn secondary" @click="download('origin-rules.txt', rules)">
          <Download :size="15" />
          {{ tr('Xuất .txt', 'Export .txt') }}
        </button>
        <input ref="ruleFile" type="file" accept=".txt" hidden @change="importRules" />
      </div>
    </article>

    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Phần tử đã ẩn bằng công cụ chọn', 'Hidden elements (Picker)') }}</h2>
          <p>
            {{ picked.length }} {{ tr('trang web', 'websites') }} ·
            {{ num(totalSelectors) }} {{ tr('bộ chọn CSS đã lưu', 'saved CSS selectors') }}
          </p>
        </div>
      </div>

      <label v-if="picked.length" class="search-field">
        <Search :size="17" />
        <input
          v-model="pickedQuery"
          :placeholder="tr('Tìm theo tên miền hoặc CSS selector…', 'Filter by domain or selector…')"
        />
      </label>

      <div v-if="!filteredPicked.length" class="empty">
        <EyeOff :size="28" />
        <span>{{ tr('Chưa có phần tử nào được ẩn bằng công cụ chọn', 'No saved hidden elements yet') }}</span>
      </div>

      <div v-for="entry in filteredPicked" :key="entry[0]" class="picked">
        <div class="picked-head">
          <div style="display: flex; align-items: center; gap: 8px">
            <b>{{ entry[0] }}</b>
            <StatusPill tone="neutral" :label="`${entry[1].length}`" hide-icon />
          </div>
          <button
            type="button"
            class="btn secondary compact"
            :disabled="busy"
            @click="$emit('removeAllPicked', entry[0])"
          >
            <Trash2 :size="13" />
            {{ tr('Xóa hết trang này', 'Clear site') }}
          </button>
        </div>
        <div v-for="sel in entry[1]" :key="sel" class="list-row" style="min-height: 44px; padding: 8px 0">
          <code class="list-details mono" style="font-size: 12px">{{ sel }}</code>
          <button
            type="button"
            class="icon-button"
            :disabled="busy"
            :title="tr('Xóa bộ chọn này', 'Remove selector')"
            :aria-label="tr('Xóa bộ chọn này', 'Remove selector')"
            @click="$emit('removePicked', entry[0], sel)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>
    </article>
  </section>
</template>
