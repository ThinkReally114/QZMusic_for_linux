<template>
  <div
    ref="outerDiv"
    class="textMarquee"
    :class="{ [className || '']: true }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div ref="innerDiv">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

const props = defineProps<{
  className?: string;
}>();

const outerDiv = ref<HTMLDivElement | null>(null);
const innerDiv = ref<HTMLDivElement | null>(null);
const currentAnimations = new Set<Animation>();

const onMouseEnter = () => {
  if (innerDiv.value && outerDiv.value) {
    const outerWidth = outerDiv.value.clientWidth;
    const innerWidth = innerDiv.value.clientWidth;

    if (innerWidth <= outerWidth * 0.95) {
      return;
    }

    outerDiv.value.classList.add('animating');

    const distance = innerWidth - outerWidth * 0.95;

    const ani = innerDiv.value.animate(
      [
        {
          transform: "translateX(0px)",
        },
        {
          transform: `translateX(${-distance}px)`,
        },
      ],
      {
        iterations: 2,
        direction: "alternate",
        easing: "linear",
        duration: Math.max(0, ((distance * 2) / 64) * 1000),
      },
    );

    ani.finished.then(() => {
      outerDiv.value?.classList.remove('animating');
    });

    currentAnimations.add(ani);
  }
};

const onMouseLeave = () => {
  for (const ani of currentAnimations) {
    ani.finish();
  }
  outerDiv.value?.classList.remove('animating');
  currentAnimations.clear();
};

onUnmounted(() => {
  onMouseLeave();
});
</script>

<style scoped>
.textMarquee {
	min-width: 0;
	overflow: hidden;
	-webkit-mask-image: linear-gradient(to right, #000 95%, #0000);
    mask-image: linear-gradient(to right, #000 95%, #0000);

	&.animating {
		-webkit-mask-image: linear-gradient(
			to left,
			#0000,
			#000 5%,
			#000 95%,
			#0000
		);
        mask-image: linear-gradient(
			to left,
			#0000,
			#000 5%,
			#000 95%,
			#0000
		);
	}

	& > * {
		width: fit-content;
	}
}
</style>
