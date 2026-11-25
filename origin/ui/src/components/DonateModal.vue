<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { Coffee, ExternalLink, X } from 'lucide-vue-next';
import { tr, web } from '../api';

const qrUrl = web.runtime.getURL('img/donate-qr.jpg');

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function onKeyDown(e: KeyboardEvent) {
  if (props.open && e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-backdrop"
      role="presentation"
      @click.self="$emit('close')"
    >
      <div
        class="donate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-modal-title"
      >
        <div class="donate-head">
          <span class="donate-badge" aria-hidden="true">
            <Coffee :size="17" />
          </span>
          <div style="flex: 1; min-width: 0">
            <h2 id="donate-modal-title">
              {{ tr('Mời tôi một ly cà phê', 'Take my coffee') }}
            </h2>
            <small>
              {{ tr('Quét mã QR để ủng hộ tác giả', 'Scan the QR code to support') }}
            </small>
          </div>
          <button
            type="button"
            class="icon-button"
            :title="tr('Đóng', 'Close')"
            :aria-label="tr('Đóng', 'Close')"
            @click="$emit('close')"
          >
            <X :size="16" />
          </button>
        </div>

        <p class="donate-note">
          {{
            tr(
              'Cảm ơn bạn đã đồng hành giúp mình duy trì Origin uBlock và bộ lọc quảng cáo Việt Nam.',
              'Thank you for supporting me in maintaining Origin uBlock and Vietnam filter lists.'
            )
          }}
        </p>

        <div class="donate-qr-wrap">
          <img
            :src="qrUrl"
            :alt="tr('Mã QR ủng hộ Thế Lợi', 'QR Code Donate — Thế Lợi')"
            class="donate-qr-img"
          />
        </div>

        <div class="donate-foot">
          <span class="footer-author">
            <b>Thế Lợi</b> ·
            <a
              href="https://theloi.io.vn"
              target="_blank"
              rel="noopener noreferrer"
            >
              theloi.io.vn
              <ExternalLink :size="11" style="display: inline; vertical-align: -1px" />
            </a>
          </span>
          <button
            type="button"
            class="btn secondary compact"
            @click="$emit('close')"
          >
            {{ tr('Đóng', 'Close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
