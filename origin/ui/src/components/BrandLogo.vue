<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
defineProps<{ size?: number; large?: boolean }>();
</script>
<template>
  <span class="brand-mark" :class="{ large }">
    <ShieldCheck :size="size || (large ? 36 : 22)" :stroke-width="2.1" />
  </span>
</template>
