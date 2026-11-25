<script setup lang="ts">
import { ref } from 'vue';
import { Coffee } from 'lucide-vue-next';
import DonateModal from './DonateModal.vue';
import { tr } from '../api';

defineProps<{
  compact?: boolean;
}>();

const showDonate = ref(false);
</script>

<template>
  <footer :class="compact ? 'popup-footer' : 'dashboard-footer'">
    <span class="footer-author">
      <b>Thế Lợi</b> ·
      <a href="https://theloi.io.vn" target="_blank" rel="noopener noreferrer">theloi.io.vn</a>
    </span>
    <button
      type="button"
      class="coffee-btn"
      :class="{ compact }"
      :title="tr('Mời tôi một ly cà phê (Quét mã QR ủng hộ)', 'Take my coffee (Scan QR to donate)')"
      @click="showDonate = true"
    >
      <Coffee :size="compact ? 12 : 14" />
      <span>{{ tr('Mời cà phê · Donate', 'Take my coffee') }}</span>
    </button>
    <DonateModal :open="showDonate" @close="showDonate = false" />
  </footer>
</template>
