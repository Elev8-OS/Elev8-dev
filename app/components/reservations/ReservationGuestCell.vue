<script setup lang="ts">
interface Props {
  name: string
  email: string
}

const props = defineProps<Props>()

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// Deterministic per-name avatar color — consistent with the users table.
const AVATAR_COLORS = [
  'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  'bg-lime-500/10 text-lime-700 dark:text-lime-300',
]

function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}
</script>

<template>
  <div class="flex items-center gap-3">
    <Avatar class="size-9">
      <AvatarFallback :class="avatarColorFor(props.name)" class="text-xs">
        {{ initials(props.name) }}
      </AvatarFallback>
    </Avatar>
    <div class="min-w-0">
      <p class="text-sm font-medium truncate">
        {{ props.name }}
      </p>
      <p class="text-xs text-muted-foreground truncate">
        {{ props.email }}
      </p>
    </div>
  </div>
</template>
