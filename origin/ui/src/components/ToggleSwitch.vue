<script setup lang="ts">
defineProps<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  banner?: boolean;
}>();
defineEmits<{ (e: 'toggle'): void }>();
</script>
<template>
  <button
    type="button"
    class="switch"
    :class="{ 'banner-switch': banner }"
    role="switch"
    :aria-checked="checked"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('toggle')"
  >
    <span />
  </button>
</template>
