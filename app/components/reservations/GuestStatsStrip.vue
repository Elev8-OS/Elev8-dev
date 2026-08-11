<script setup lang="ts">
interface Props {
  totalStays: number
  upcoming: number
  current: number
  totalSpent: number
  currency: string
}

const props = defineProps<Props>()

function fmtCurrency(amount: number): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${props.currency}`
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground">
          Total stays
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ totalStays }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground">
          Upcoming
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ upcoming }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground">
          Current
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ current }}
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground">
          Total spent
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ fmtCurrency(totalSpent) }}
        </div>
      </CardContent>
    </Card>
  </div>
</template>
