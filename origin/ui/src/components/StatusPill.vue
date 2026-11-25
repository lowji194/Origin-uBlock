<script setup lang="ts">
import { computed } from 'vue';
import {
  CheckCircle2,
  CircleX,
  AlertTriangle,
  Info,
  Clock,
  PauseCircle,
  Shield,
} from 'lucide-vue-next';
import type { SemanticTone } from '../types';

const props = defineProps<{
  tone?: SemanticTone;
  label: string;
  hideIcon?: boolean;
}>();

const iconComp = computed(() => {
  switch (props.tone) {
    case 'success':
      return CheckCircle2;
    case 'danger':
      return CircleX;
    case 'warning':
      return AlertTriangle;
    case 'scheduled':
      return Clock;
    case 'info':
      return Info;
    case 'accent':
      return Shield;
    default:
      return PauseCircle;
  }
});
</script>
<template>
  <span class="status-pill" :data-tone="tone || 'neutral'">
    <component :is="iconComp" v-if="!hideIcon" :size="12" :stroke-width="2.2" />
    <span>{{ label }}</span>
  </span>
</template>
