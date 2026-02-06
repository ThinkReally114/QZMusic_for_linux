<template>
  <div class="view-container local-view">
    <h1 class="view-title">Local Files</h1>
    <div class="empty-state">
      <div class="icon-box">
        <Icon icon="lucide:music" width="48" height="48" />
      </div>
      <p>No local files scanned yet.</p>
      <button class="action-btn">Scan Folder</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
</script>

<style scoped>
.view-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 24px;
}

.empty-state {
  height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.icon-box {
  background-color: var(--color-bg-secondary);
  padding: 24px;
  border-radius: 50%;
  margin-bottom: 24px;
}

.action-btn {
  margin-top: 24px;
  background-color: var(--color-accent);
  color: var(--color-bg-primary);
  padding: 12px 24px;
  border-radius: var(--radius-full);
  font-weight: 600;
  transition: opacity 0.2s;
}

.action-btn:hover {
  opacity: 0.9;
}
</style>
