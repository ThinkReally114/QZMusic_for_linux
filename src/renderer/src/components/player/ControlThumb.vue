<template>
  <div class="controlThumb" @click="onClick">
    <button type="button" class="knob"></button>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['click']);

const onClick = () => {
  emit('click');
};
</script>

<style scoped>
.controlThumb {
  width: 100%;
  height: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 10;
  position: relative;
  -webkit-app-region: no-drag;
}

.knob {
  width: 70px;
  height: 10px;
  border-radius: 4px;
  background-color: #ffffff2d;
  border: none;
  padding: 0;
  cursor: pointer;
  /* 可选：加一点反馈 */
  transition: background-color 0.2s;
}

.knob:hover {
  background-color: #ffffff4d;
}

.knob:active {
  transform: scale(0.95);
}
</style>