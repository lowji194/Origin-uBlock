<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Globe,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  Pencil,
} from 'lucide-vue-next';
import { tr, hostname, download } from '../api';

const props = defineProps<{
  exceptions: string[];
  protectedOn: boolean;
  modeRestricted: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'addHost', h: string, editOld: string): void;
  (e: 'removeHost', h: string): void;
  (e: 'bulkAdd', hosts: string[]): void;
  (e: 'clearAll', hosts: string[]): void;
}>();

const host = ref('');
const editHost = ref('');
const query = ref('');
const showBulk = ref(false);
const bulkText = ref('');
const fileRef = ref<HTMLInputElement | null>(null);

const visibleHosts = computed(() =>
  props.exceptions.filter((h) => h.includes(query.value.trim().toLowerCase()))
);

function submitSingle() {
  if (!host.value.trim()) return;
  emit('addHost', host.value.trim(), editHost.value);
  host.value = '';
  editHost.value = '';
}

function startEdit(h: string) {
  editHost.value = h;
  host.value = h;
}

function submitBulk() {
  const lines = bulkText.value
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed: string[] = [];
  for (const line of lines) {
    try {
      parsed.push(hostname(line));
    } catch {
      // skip invalid lines
    }
  }
  if (parsed.length) {
    emit('bulkAdd', parsed);
    bulkText.value = '';
    showBulk.value = false;
  }
}

async function importFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  bulkText.value = await f.text();
  showBulk.value = true;
  input.value = '';
}
</script>

<template>
  <section class="stack" data-page="exceptions">
    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Trang web được cho phép (Allowlist)', 'Allowlisted websites') }}</h2>
          <p>
            {{ exceptions.length }} {{ tr('tên miền sẽ không bị lọc quảng cáo hoặc Stealth', 'domains excluded from filtering and Stealth') }}
          </p>
        </div>
        <div class="form-row wrap" style="margin-top: 0">
          <button
            type="button"
            class="btn secondary compact"
            :disabled="busy || !protectedOn || modeRestricted"
            @click="showBulk = !showBulk"
          >
            <Plus :size="14" />
            {{ tr('Nhập hàng loạt', 'Bulk import') }}
          </button>
          <button
            type="button"
            class="btn secondary compact"
            :disabled="!exceptions.length"
            @click="download('origin-allowlist.txt', exceptions.join('\n'))"
          >
            <Download :size="14" />
            {{ tr('Xuất .txt', 'Export .txt') }}
          </button>
          <button
            v-if="exceptions.length"
            type="button"
            class="btn danger compact"
            :disabled="busy || !protectedOn || modeRestricted"
            @click="$emit('clearAll', exceptions)"
          >
            <Trash2 :size="14" />
            {{ tr('Xóa tất cả', 'Clear all') }}
          </button>
        </div>
      </div>

      <div v-if="!protectedOn" class="notice warning" style="margin-bottom: 12px">
        <AlertTriangle :size="16" />
        <span>
          {{
            tr(
              'Hãy bật lại bảo vệ toàn cục trước khi chỉnh sửa danh sách ngoại lệ.',
              'Resume global protection before editing website exceptions.'
            )
          }}
        </span>
      </div>

      <form class="form-row" @submit.prevent="submitSingle">
        <input
          v-model="host"
          class="field"
          required
          placeholder="example.com"
          :disabled="!protectedOn || modeRestricted"
        />
        <button type="submit" class="btn primary" :disabled="busy || !protectedOn || modeRestricted">
          <Plus :size="16" />
          {{ editHost ? tr('Lưu thay đổi', 'Save') : tr('Thêm tên miền', 'Add domain') }}
        </button>
        <button
          v-if="editHost"
          type="button"
          class="btn secondary"
          @click="editHost = ''; host = ''"
        >
          {{ tr('Hủy', 'Cancel') }}
        </button>
      </form>

      <div v-if="showBulk" class="picked" style="margin-top: 12px">
        <div class="picked-head">
          <b>{{ tr('Nhập nhiều tên miền cùng lúc', 'Bulk import domains') }}</b>
          <button type="button" class="btn secondary compact" @click="fileRef?.click()">
            <Upload :size="14" />
            {{ tr('Nạp từ tệp .txt', 'Load .txt file') }}
          </button>
          <input ref="fileRef" type="file" accept=".txt" hidden @change="importFile" />
        </div>
        <textarea
          v-model="bulkText"
          class="editor"
          style="min-height: 110px; margin-top: 6px"
          :placeholder="tr('Mỗi dòng một tên miền hoặc URL, ví dụ:\nexample.com\nhttps://bank.example.vn/login', 'One domain or URL per line')"
        />
        <div class="form-row wrap" style="margin-top: 8px">
          <button
            type="button"
            class="btn primary compact"
            :disabled="busy || !bulkText.trim() || !protectedOn || modeRestricted"
            @click="submitBulk"
          >
            {{ tr('Thêm tất cả hợp lệ', 'Add valid domains') }}
          </button>
          <button type="button" class="btn secondary compact" @click="showBulk = false">
            {{ tr('Đóng', 'Close') }}
          </button>
        </div>
      </div>

      <label class="search-field" style="margin-top: 12px">
        <Search :size="17" />
        <input v-model="query" :placeholder="tr('Tìm tên miền trong danh sách…', 'Search allowlisted domains…')" />
      </label>

      <div v-if="!visibleHosts.length" class="empty">
        <Globe :size="28" />
        <span>{{ tr('Chưa có website ngoại lệ', 'No allowlisted websites') }}</span>
      </div>

      <div v-for="h in visibleHosts" :key="h" class="list-row">
        <span class="list-icon"><Globe :size="18" /></span>
        <b class="list-details">{{ h }}</b>
        <button
          type="button"
          class="btn secondary compact"
          :disabled="busy || !protectedOn || modeRestricted"
          @click="startEdit(h)"
        >
          <Pencil :size="13" />
          {{ tr('Sửa', 'Edit') }}
        </button>
        <button
          type="button"
          class="icon-button"
          :disabled="busy || !protectedOn || modeRestricted"
          :title="tr('Xóa ngoại lệ', 'Remove exception')"
          :aria-label="tr('Xóa ngoại lệ', 'Remove exception')"
          @click="$emit('removeHost', h)"
        >
          <Trash2 :size="17" />
        </button>
      </div>
    </article>
  </section>
</template>
