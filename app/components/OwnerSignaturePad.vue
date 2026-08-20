<script setup lang="ts">
// Owner signature pad — canvas-based draw-to-sign (PRD 5.3).
//
// The owner draws their signature with pointer/touch input; the pad exposes
// an empty state, clear, and the final data-URL (PNG) via v-model. No
// external signature library — plain canvas + Pointer Events.

const modelValue = defineModel<string>({ default: '' })

const canvasEl = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
const hasInk = ref(false)

const CANVAS_HEIGHT = 180

let ctx: CanvasRenderingContext2D | null = null

function resizeCanvas() {
  const canvas = canvasEl.value
  if (!canvas)
    return
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = CANVAS_HEIGHT * dpr
  ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'hsl(var(--foreground))'
  // Redraw existing ink after a resize.
  if (modelValue.value)
    drawImage(modelValue.value)
}

function pos(e: PointerEvent): { x: number, y: number } {
  const rect = canvasEl.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerDown(e: PointerEvent) {
  if (!ctx)
    return
  drawing.value = true
  canvasEl.value!.setPointerCapture(e.pointerId)
  const { x, y } = pos(e)
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function onPointerMove(e: PointerEvent) {
  if (!drawing.value || !ctx)
    return
  const { x, y } = pos(e)
  ctx.lineTo(x, y)
  ctx.stroke()
  if (!hasInk.value)
    hasInk.value = true
}

function onPointerUp() {
  if (!drawing.value)
    return
  drawing.value = false
  modelValue.value = canvasEl.value!.toDataURL('image/png')
  hasInk.value = true
}

function clearSignature() {
  const canvas = canvasEl.value
  if (!canvas || !ctx)
    return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  modelValue.value = ''
  hasInk.value = false
}

function drawImage(dataUrl: string) {
  const img = new Image()
  img.onload = () => {
    if (ctx && canvasEl.value) {
      const rect = canvasEl.value.getBoundingClientRect()
      ctx.drawImage(img, 0, 0, rect.width, CANVAS_HEIGHT)
    }
  }
  img.src = dataUrl
}

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<template>
  <div class="space-y-2">
    <div
      class="relative overflow-hidden rounded-md border bg-card"
      :class="modelValue ? 'border-green-500/50' : 'border-dashed'"
    >
      <canvas
        ref="canvasEl"
        class="block h-[180px] w-full cursor-crosshair touch-none"
        :style="{ height: `${CANVAS_HEIGHT}px` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
      <span
        v-if="!hasInk && !modelValue"
        class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
      >
        Draw your signature here
      </span>
    </div>
    <div class="flex items-center justify-between">
      <p class="text-xs text-muted-foreground">
        {{ modelValue ? 'Signature captured ✓' : 'Use mouse or touch to draw' }}
      </p>
      <Button
        v-if="hasInk || modelValue"
        type="button"
        variant="ghost"
        size="sm"
        @click="clearSignature"
      >
        <Icon name="lucide:eraser" class="mr-1.5 size-3.5" />
        Clear
      </Button>
    </div>
  </div>
</template>
