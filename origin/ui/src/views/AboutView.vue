<script setup lang="ts">
import { ExternalLink, Shield, CheckCircle2, ArrowRight, Sparkles, Lock } from 'lucide-vue-next';
import BrandLogo from '../components/BrandLogo.vue';
import StatusPill from '../components/StatusPill.vue';
import { tr, version, protectionModes } from '../api';

defineProps<{
  pane: 'about' | 'welcome';
  config: any;
  modeRestricted: boolean;
  busy: boolean;
}>();

defineEmits<{
  (e: 'levelChange', n: number): void;
  (e: 'applyPreset', preset: 'balanced' | 'adguard' | 'max'): void;
  (e: 'go', pane: string): void;
}>();
</script>

<template>
  <section v-if="pane === 'welcome'" class="stack" data-page="welcome">
    <article class="panel">
      <h2>{{ tr('1. Chọn mức bảo vệ mặc định', '1. Choose default protection level') }}</h2>
      <p class="subtext">
        {{ tr('Bạn luôn có thể tinh chỉnh riêng cho từng website ngay trên popup thanh công cụ.', 'You can always customize per-website levels directly from the toolbar popup.') }}
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
          <b>{{ m.name }}</b>
          <small>{{ m.desc }}</small>
          <CheckCircle2 v-if="config.defaultFilteringMode === m.id" :size="17" class="mode-check" />
        </button>
      </div>
    </article>

    <article class="panel">
      <h2>{{ tr('2. Chọn hồ sơ lọc nhanh', '2. Pick a quick protection profile') }}</h2>
      <p class="subtext">
        {{ tr('Bộ lọc Việt Nam (Lowji194 Desktop & ABPVN) và bộ lọc AdGuard/ABP đã được tích hợp sẵn. Chọn thêm chế độ phù hợp với bạn:', 'Vietnam filters (Lowji194 Desktop & ABPVN) and AdGuard/ABP lists are built in. Optionally select a preset:') }}
      </p>
      <div class="form-row wrap">
        <button type="button" class="btn secondary" :disabled="busy" @click="$emit('applyPreset', 'balanced')">
          <Shield :size="15" />
          {{ tr('Chuẩn cân bằng', 'Balanced') }}
        </button>
        <button type="button" class="btn secondary" :disabled="busy" @click="$emit('applyPreset', 'adguard')">
          <Sparkles :size="15" />
          {{ tr('Sạch & Tàng hình (Khuyên dùng)', 'Clean + Stealth (Recommended)') }}
        </button>
        <button type="button" class="btn secondary" :disabled="busy" @click="$emit('applyPreset', 'max')">
          <Lock :size="15" />
          {{ tr('Lá chắn tối đa', 'Maximum Shield') }}
        </button>
      </div>
    </article>

    <article class="panel">
      <h2>{{ tr('3. Sẵn sàng duyệt web sạch & riêng tư', '3. Ready to browse safely') }}</h2>
      <p class="subtext">
        {{ tr('Ghim biểu tượng Origin uBlock lên thanh công cụ Chrome để dùng nút Chặn phần tử và Hẹn giờ tạm dừng nhanh.', 'Pin Origin uBlock to your Chrome toolbar for instant Element Blocker and Snooze controls.') }}
      </p>
      <div class="form-row">
        <button type="button" class="btn primary" @click="$emit('go', 'overview')">
          {{ tr('Đi đến Tổng quan', 'Open overview') }}
          <ArrowRight :size="16" />
        </button>
      </div>
    </article>
  </section>

  <section v-else class="stack" data-page="about">
    <article class="panel about-panel">
      <BrandLogo large :size="36" />
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
        <h2>Origin uBlock (Lowji Edition) v{{ version }}</h2>
        <StatusPill tone="success" label="Chromium MV3" />
        <StatusPill tone="info" label="Zero Telemetry" />
      </div>
      <p>
        {{
          tr(
            'Bản fork độc lập phát triển trên nền tảng uBlock Origin Lite (MV3), kết hợp trải nghiệm quản lý trực quan và các lớp bảo vệ nổi bật từ AdGuard và Adblock Plus. Không liên kết chính thức với uBlock Origin, AdGuard hay Adblock Plus.',
            'Independent unofficial fork built on uBlock Origin Lite (MV3), combining protection workflows inspired by AdGuard and Adblock Plus. Not affiliated with uBlock Origin, AdGuard or Adblock Plus.'
          )
        }}
      </p>
      <p class="small">GNU GPL-3.0 · Copyright (c) Raymond Hill &amp; Origin uBlock contributors</p>
      <div class="form-row wrap">
        <a
          class="btn secondary"
          href="https://github.com/lowji194/Origin-uBlock"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ tr('Mã nguồn GitHub', 'GitHub Source') }}
          <ExternalLink :size="14" />
        </a>
        <a
          class="btn secondary"
          href="https://github.com/lowji194/Origin-uBlock/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ tr('Phiên bản phát hành', 'Releases') }}
          <ExternalLink :size="14" />
        </a>
        <a
          class="btn secondary"
          href="https://github.com/lowji194/Origin-uBlock/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ tr('Báo lỗi & Góp ý', 'Issues') }}
          <ExternalLink :size="14" />
        </a>
      </div>
    </article>

    <article class="panel">
      <h2>{{ tr('Cam kết quyền riêng tư & Minh bạch MV3', 'Privacy Commitment & MV3 Transparency') }}</h2>
      <p class="subtext">
        {{
          tr(
            'Không thu thập lịch sử duyệt web, không gửi dữ liệu phân tích. Thống kê tùy chọn chỉ đọc bộ đếm số cục bộ của trình duyệt. Không có chương trình "Quảng cáo chấp nhận được" (Zero Acceptable Ads) và không đóng gói danh sách trả phí.',
            'No browsing history collection or analytics telemetry. Optional statistics only observe numeric browser badge counters locally. Zero Acceptable Ads and no paid/VIP lists bundled.'
          )
        }}
      </p>
    </article>
  </section>
</template>
