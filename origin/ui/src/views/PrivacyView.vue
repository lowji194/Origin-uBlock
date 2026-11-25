<script setup lang="ts">
import { computed } from 'vue';
import {
  Fingerprint,
  EyeOff,
  Link2Off,
  Radio,
  ShieldAlert,
  Sparkles,
  Cookie,
  MessageSquareOff,
  BellOff,
  Bot,
  Share2,
  AppWindow,
} from 'lucide-vue-next';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import StatusPill from '../components/StatusPill.vue';
import { tr, num } from '../api';
import type { StealthConfig, RulesetDetail } from '../types';

const props = defineProps<{
  config: any;
  stealth: StealthConfig;
  listData: RulesetDetail[];
  enabledSet: Set<string>;
  adminRulesets: string[];
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleStealth', key: keyof StealthConfig): void;
  (e: 'toggleList', r: RulesetDetail): void;
  (e: 'changeSetting', msg: string, currentVal: boolean): void;
}>();

const adminList = (id: string) =>
  (props.adminRulesets || []).some((a) => [id, '+' + id, '-' + id].includes(a));

const stealthItems = computed(() => [
  {
    key: 'stripUtmCustom' as const,
    icon: Link2Off,
    title: tr('Xóa tham số theo dõi khỏi URL', 'Strip tracking URL parameters'),
    desc: tr(
      'Tự động loại bỏ utm_*, fbclid, gclid, yclid, mc_cid, igshid khỏi thanh địa chỉ khi điều hướng.',
      'Automatically removes utm_*, fbclid, gclid, yclid, mc_cid, igshid on page navigation.'
    ),
    badge: 'URL Cleaner',
  },
  {
    key: 'blockPing' as const,
    icon: Radio,
    title: tr('Chặn Ping & Beacon theo dõi', 'Block tracking pings & beacons'),
    desc: tr(
      'Ngăn trình duyệt gửi tín hiệu sendBeacon, hyperlink auditing (ping) và csp_report tới bên thứ ba.',
      'Blocks third-party navigator.sendBeacon, ping auditing and csp_report requests.'
    ),
    badge: 'Beacon Block',
  },
  {
    key: 'stripReferrer' as const,
    icon: EyeOff,
    title: tr('Ẩn tiêu đề Referer với bên thứ ba', 'Hide Referer from third parties'),
    desc: tr(
      'Xóa header Referer đối với tài nguyên nhúng bên thứ ba để tránh lộ trang web bạn đang xem.',
      'Strips the Referer header on third-party subresource requests.'
    ),
    badge: 'Header Shield',
  },
  {
    key: 'stripClientData' as const,
    icon: Fingerprint,
    title: tr('Xóa tiêu đề X-Client-Data', 'Strip X-Client-Data header'),
    desc: tr(
      'Ngăn gửi mã định danh thử nghiệm trình duyệt tới các máy chủ bên thứ ba.',
      'Removes Chrome variation identification headers from third-party requests.'
    ),
    badge: 'Anti-Fingerprint',
  },
]);

const trackingLists = computed(() =>
  props.listData.filter((r) =>
    [
      'adguard-tracking',
      'adguard-dns',
      'easyprivacy',
      'adguard-spyware-url',
      'block-lan',
      'ublock-badware',
      'urlhaus-full',
    ].includes(r.id)
  )
);

const annoyanceLists = computed(() =>
  props.listData.filter((r) => r.group === 'annoyances')
);

function annoyanceIcon(id: string) {
  if (id.includes('cookies')) return Cookie;
  if (id.includes('widgets')) return MessageSquareOff;
  if (id.includes('notifications')) return BellOff;
  if (id.includes('ai')) return Bot;
  if (id.includes('social')) return Share2;
  return Sparkles;
}
</script>

<template>
  <section class="stack" data-page="privacy">
    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Chế độ tàng hình (Stealth Mode)', 'Stealth Mode') }}</h2>
          <p>
            {{
              tr(
                'Ngăn rò rỉ dữ liệu theo dõi trực tiếp qua bộ lọc mạng trình duyệt, tôn trọng danh sách ngoại lệ.',
                'Prevents tracking leaks natively in the browser and respects your website allowlist.'
              )
            }}
          </p>
        </div>
        <StatusPill
          :tone="Object.values(stealth).some(Boolean) ? 'info' : 'neutral'"
          :label="
            Object.values(stealth).filter(Boolean).length +
            '/4 ' +
            tr('lớp bật', 'active')
          "
        />
      </div>

      <div v-for="item in stealthItems" :key="item.key" class="list-row">
        <span class="list-icon" style="color: var(--tone-info-ink); background: var(--tone-info-bg)">
          <component :is="item.icon" :size="18" />
        </span>
        <div class="list-details">
          <div class="list-title-wrap">
            <b>{{ item.title }}</b>
            <StatusPill tone="info" :label="item.badge" hide-icon />
          </div>
          <small>{{ item.desc }}</small>
        </div>
        <ToggleSwitch
          :checked="Boolean(stealth[item.key])"
          :disabled="busy"
          :label="item.title"
          @toggle="$emit('toggleStealth', item.key)"
        />
      </div>
    </article>

    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Danh sách chống theo dõi & Bảo mật', 'Tracking & Security protection lists') }}</h2>
          <p>
            {{
              tr(
                'Các danh sách chống gián điệp, xâm nhập mạng nội bộ LAN và trang web độc hại.',
                'Filter lists against trackers, LAN intrusion and phishing/malware domains.'
              )
            }}
          </p>
        </div>
      </div>

      <div v-for="r in trackingLists" :key="r.id" class="list-row">
        <span class="list-icon">
          <ShieldAlert v-if="r.group === 'malware'" :size="18" style="color: var(--tone-danger-ink)" />
          <Fingerprint v-else :size="18" />
        </span>
        <div class="list-details">
          <b>{{ r.name }}</b>
          <small>
            {{ num((r.rules?.plain || 0) + (r.rules?.regex || 0)) }}
            {{ tr('quy tắc mạng', 'network rules') }}
          </small>
        </div>
        <ToggleSwitch
          :checked="enabledSet.has(r.id)"
          :disabled="busy || adminList(r.id)"
          :label="r.name"
          @toggle="$emit('toggleList', r)"
        />
      </div>

      <div class="list-row">
        <span class="list-icon">
          <AppWindow :size="18" />
        </span>
        <div class="list-details">
          <b>{{ tr('Chặn cửa sổ bật lên (Pop-up Blocker)', 'Pop-up window blocker') }}</b>
          <small>
            {{
              tr(
                'Ngăn tab/cửa sổ quảng cáo tự động mở khi nhấp chuột trên trang web.',
                'Prevents unwanted pop-up windows and tab-unders.'
              )
            }}
          </small>
        </div>
        <ToggleSwitch
          :checked="Boolean(config.popupBlockMode)"
          :disabled="busy"
          :label="tr('Chặn cửa sổ bật lên', 'Block pop-ups')"
          @toggle="$emit('changeSetting', 'setPopupBlockMode', Boolean(config.popupBlockMode))"
        />
      </div>
    </article>

    <article class="panel">
      <div class="panel-header">
        <div>
          <h2>{{ tr('Chặn thành phần gây phiền nhiễu (Annoyances Suite)', 'Annoyances Suite') }}</h2>
          <p>
            {{
              tr(
                'Loại bỏ banner Cookie, popup đăng ký nhận tin, widget chat và lời mời bật thông báo.',
                'Remove cookie consent banners, newsletter overlays, chat widgets and notification prompts.'
              )
            }}
          </p>
        </div>
      </div>

      <div class="layers-grid">
        <div v-for="r in annoyanceLists" :key="r.id" class="layer-card" style="align-items: center">
          <span class="layer-icon warning">
            <component :is="annoyanceIcon(r.id)" :size="18" />
          </span>
          <div class="layer-body">
            <b>{{ r.name }}</b>
            <small>{{ num((r.rules?.plain || 0) + (r.rules?.regex || 0)) }} {{ tr('quy tắc', 'rules') }}</small>
          </div>
          <ToggleSwitch
            :checked="enabledSet.has(r.id)"
            :disabled="busy || adminList(r.id)"
            :label="r.name"
            @toggle="$emit('toggleList', r)"
          />
        </div>
      </div>
    </article>
  </section>
</template>
