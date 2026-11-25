<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Activity,
  Info,
  Search,
  RefreshCw,
  Download,
  Eye,
  X,
} from 'lucide-vue-next';
import StatusPill from '../components/StatusPill.vue';
import { tr, num, api, download, groupMeta, parseRulesetDisplay } from '../api';
import type { ActivitySnapshot, RulesetDetail, MatchedRuleEntry } from '../types';

const props = defineProps<{
  activity: ActivitySnapshot | null;
  listData: RulesetDetail[];
}>();

defineEmits<{ (e: 'refresh'): void }>();

const activityQuery = ref('');
const selectedRuleset = ref('all');
const inspected = ref<{
  entry: MatchedRuleEntry;
  ruleData: any;
  loading: boolean;
  error: string;
} | null>(null);

const rulesetCache = new Map<string, any[]>();

const rulesetMap = computed(() => {
  const m = new Map<string, RulesetDetail>();
  for (const r of props.listData) m.set(r.id, r);
  return m;
});

function resolveRuleset(id?: string) {
  if (!id) {
    return {
      name: tr('Không xác định', 'Unknown'),
      group: 'other',
    };
  }
  if (id === '_dynamic' || id === 'uBOL.dynamic') {
    return {
      name: tr('Quy tắc động / Stealth / Người dùng', 'Dynamic / Stealth / User Rules'),
      group: 'imported',
    };
  }
  if (id === '_session' || id === 'uBOL.session') {
    return {
      name: tr('Quy tắc phiên (Strict Block)', 'Session Rules (Strict Block)'),
      group: 'malware',
    };
  }
  const detail = rulesetMap.value.get(id);
  if (!detail) return { name: id, group: 'other' };
  return {
    name: parseRulesetDisplay(detail).title,
    group: detail.group || 'other',
  };
}

const byRuleset = computed(() => {
  const counts = new Map<string, number>();
  for (const m of props.activity?.matches || []) {
    const id = m.rule?.rulesetId || 'unknown';
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, total]) => ({
      id,
      total,
      ...resolveRuleset(id),
    }))
    .sort((a, b) => b.total - a.total);
});

const recent = computed(() => {
  const q = activityQuery.value.trim().toLowerCase();
  return (props.activity?.matches || [])
    .filter((r) => {
      const rid = r.rule?.rulesetId || '';
      if (selectedRuleset.value !== 'all' && rid !== selectedRuleset.value) return false;
      if (!q) return true;
      const resolved = resolveRuleset(rid).name.toLowerCase();
      return (
        resolved.includes(q) ||
        JSON.stringify(r.rule || {}).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.timeStamp - a.timeStamp)
    .slice(0, 250);
});

async function inspectRule(entry: MatchedRuleEntry) {
  const rulesetId = entry.rule?.rulesetId;
  const ruleId = entry.rule?.ruleId;
  inspected.value = { entry, ruleData: null, loading: true, error: '' };
  try {
    if (!rulesetId || ruleId === undefined) {
      throw Error(tr('Thiếu thông tin mã quy tắc', 'Missing rule identifier'));
    }
    let rules = rulesetCache.get(rulesetId);
    if (!rules) {
      if (rulesetId === '_dynamic' || rulesetId === 'uBOL.dynamic') {
        rules = (await api('getAllDynamicRules')) || [];
      } else if (rulesetId === '_session' || rulesetId === 'uBOL.session') {
        rules = (await api('getAllSessionRules')) || [];
      } else {
        const res = await api('getRulesetRules', { id: rulesetId });
        rules = res?.rules || [];
      }
      if (Array.isArray(rules) && rules.length) {
        rulesetCache.set(rulesetId, rules);
      }
    }
    const found = Array.isArray(rules) ? rules.find((x: any) => x.id === ruleId) : null;
    if (!found) {
      inspected.value = {
        entry,
        ruleData: null,
        loading: false,
        error: tr(
          'Không tìm thấy định nghĩa quy tắc trong bộ nhớ cục bộ (có thể là danh sách nhập dạng tuần tự hóa).',
          'Rule definition not found in local JSON (may be a serialized imported list).'
        ),
      };
      return;
    }
    inspected.value = { entry, ruleData: found, loading: false, error: '' };
  } catch (e: any) {
    inspected.value = {
      entry,
      ruleData: null,
      loading: false,
      error: e.message || String(e),
    };
  }
}

function exportCsv() {
  const header = 'time,ruleset_id,ruleset_name,rule_id';
  const rows = recent.value.map((r) => {
    const rid = r.rule?.rulesetId || '';
    const rname = resolveRuleset(rid).name.replace(/"/g, '""');
    return `"${new Date(r.timeStamp).toISOString()}","${rid}","${rname}",${r.rule?.ruleId ?? ''}`;
  });
  download('origin-matched-rules.csv', [header, ...rows].join('\n'), 'text/csv');
}
</script>

<template>
  <section class="stack" data-page="activity">
    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ activity?.hostname || tr('Chưa chọn tab để xem nhật ký', 'No tab selected') }}</h2>
          <p>
            {{
              activity?.at
                ? tr('Chụp lúc: ', 'Captured at: ') + new Date(activity.at).toLocaleString()
                : tr('Hãy mở Nhật ký từ popup của một trang web đang duyệt.', 'Open Filtering Log from a website popup.')
            }}
          </p>
        </div>
        <div class="form-row wrap" style="margin-top: 0">
          <button
            v-if="recent.length"
            type="button"
            class="btn secondary compact"
            @click="exportCsv"
          >
            <Download :size="14" />
            CSV
          </button>
          <button
            v-if="recent.length"
            type="button"
            class="btn secondary compact"
            @click="download('origin-matched-rules.json', JSON.stringify(recent, null, 2), 'application/json')"
          >
            <Download :size="14" />
            JSON
          </button>
          <button type="button" class="btn secondary compact" @click="$emit('refresh')">
            <RefreshCw :size="14" />
            {{ tr('Làm mới', 'Refresh') }}
          </button>
        </div>
      </div>

      <div class="notice" style="margin-bottom: 12px">
        <Info :size="16" />
        <span>
          {{
            tr(
              'Chrome MV3 giới hạn truy cập nhật ký theo tab đang mở từ popup và không thu thập URL truy vấn. Nhấn "Chi tiết" để giải mã điều kiện quy tắc DNR thực tế.',
              'Chrome MV3 limits log access to tabs opened from the popup without collecting full URLs. Click "Inspect" to decode the actual DNR rule condition.'
            )
          }}
        </span>
      </div>

      <div v-if="byRuleset.length" class="chips">
        <button
          type="button"
          :class="{ selected: selectedRuleset === 'all' }"
          @click="selectedRuleset = 'all'"
        >
          {{ tr('Tất cả', 'All') }} ({{ num(activity?.matches?.length || 0) }})
        </button>
        <button
          v-for="item in byRuleset"
          :key="item.id"
          type="button"
          :class="{ selected: selectedRuleset === item.id }"
          @click="selectedRuleset = item.id"
        >
          {{ item.name }} ({{ num(item.total) }})
        </button>
      </div>

      <label class="search-field">
        <Search :size="17" />
        <input
          v-model="activityQuery"
          :placeholder="tr('Tìm theo Rule ID hoặc tên bộ lọc…', 'Filter by Rule ID or filter list name…')"
        />
      </label>

      <div v-if="!activity || activity.unavailable" class="empty">
        <Activity :size="28" />
        <span>
          {{
            tr(
              'Không có quyền đọc quy tắc khớp của tab này (hãy mở Nhật ký trực tiếp từ popup khi đang ở trang web).',
              'Matched-rule access is unavailable for this tab (open Log directly from the popup on a webpage).'
            )
          }}
        </span>
      </div>

      <div v-else-if="!recent.length" class="empty">
        <Activity :size="28" />
        <span>{{ tr('Chưa có quy tắc nào khớp trên tab này', 'No matched rules returned for this tab') }}</span>
      </div>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ tr('Thời gian', 'Time') }}</th>
              <th>{{ tr('Bộ lọc áp dụng', 'Filter list') }}</th>
              <th>{{ tr('Nhóm', 'Category') }}</th>
              <th>{{ tr('Mã quy tắc', 'Rule ID') }}</th>
              <th>{{ tr('Thanh tra', 'Inspect') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in recent" :key="i">
              <td class="mono">{{ new Date(r.timeStamp).toLocaleTimeString() }}</td>
              <td>
                <b>{{ resolveRuleset(r.rule?.rulesetId).name }}</b>
                <div class="small mono">{{ r.rule?.rulesetId }}</div>
              </td>
              <td>
                <StatusPill
                  :tone="(groupMeta[resolveRuleset(r.rule?.rulesetId).group as keyof typeof groupMeta] || groupMeta.other).tone"
                  :label="(groupMeta[resolveRuleset(r.rule?.rulesetId).group as keyof typeof groupMeta] || groupMeta.other).name"
                  hide-icon
                />
              </td>
              <td class="mono">#{{ r.rule?.ruleId }}</td>
              <td>
                <button type="button" class="btn secondary compact" @click="inspectRule(r)">
                  <Eye :size="13" />
                  {{ tr('Chi tiết', 'Inspect') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="inspected" class="rule-inspector-box">
        <div class="picked-head">
          <b>
            {{ tr('Chi tiết quy tắc DNR', 'DNR Rule Inspector') }} ·
            {{ resolveRuleset(inspected.entry.rule?.rulesetId).name }} (#{{ inspected.entry.rule?.ruleId }})
          </b>
          <button
            type="button"
            class="icon-button"
            :aria-label="tr('Đóng thanh tra', 'Close inspector')"
            @click="inspected = null"
          >
            <X :size="15" />
          </button>
        </div>
        <p v-if="inspected.loading" class="small">{{ tr('Đang tải định nghĩa quy tắc…', 'Loading rule definition…') }}</p>
        <p v-else-if="inspected.error" class="small" style="color: var(--tone-warning-ink)">
          {{ inspected.error }}
        </p>
        <pre v-else>{{ JSON.stringify(inspected.ruleData, null, 2) }}</pre>
      </div>
    </article>
  </section>
</template>
