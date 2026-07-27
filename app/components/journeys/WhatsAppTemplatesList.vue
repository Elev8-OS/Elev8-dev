<script setup lang="ts">
import type { TemplateStatus, WhatsAppTemplate } from './data/whatsapp-templates'
import { toast } from 'vue-sonner'
import { statusMeta } from './data/whatsapp-templates'

withDefaults(
  defineProps<{ compact?: boolean }>(),
  { compact: false },
)

const emit = defineEmits<{
  createTemplate: []
  editTemplate: [template: WhatsAppTemplate]
}>()

const { templates, approvedTemplates, deleteTemplate, duplicateTemplate, submitTemplate } = useWhatsAppTemplates()
const { isConnected } = useWhatsApp()

const activeTab = ref<TemplateStatus | 'all'>('all')
const search = ref('')
const submittingIds = ref<Set<string>>(new Set())

// Pagination
const pageIndex = ref(0)
const pageSize = ref(10)
const pageSizeOptions = [10, 20, 30, 50]

const filteredTemplates = computed(() => {
  let list = templates.value
  if (activeTab.value !== 'all')
    list = list.filter(t => t.status === activeTab.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(t =>
      t.name.toLowerCase().includes(q)
      || t.category.toLowerCase().includes(q)
      || t.language.toLowerCase().includes(q),
    )
  }
  return list.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
})

// Reset to first page whenever filters or page size change
watch([activeTab, search, pageSize], () => {
  pageIndex.value = 0
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredTemplates.value.length / pageSize.value)))

const paginatedTemplates = computed(() => {
  const start = pageIndex.value * pageSize.value
  return filteredTemplates.value.slice(start, start + pageSize.value)
})

const canPrevPage = computed(() => pageIndex.value > 0)
const canNextPage = computed(() => pageIndex.value < pageCount.value - 1)

function setPageSize(value: string | number | null | undefined) {
  pageSize.value = value ? Number(value) : 10
}

function nextPage() {
  if (canNextPage.value)
    pageIndex.value += 1
}

function prevPage() {
  if (canPrevPage.value)
    pageIndex.value -= 1
}

function firstPage() {
  pageIndex.value = 0
}

function lastPage() {
  pageIndex.value = pageCount.value - 1
}

const statusCounts = computed(() => {
  const counts: Record<TemplateStatus, number> = {
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    paused: 0,
    disabled: 0,
  }
  templates.value.forEach(t => counts[t.status]++)
  return counts
})

async function handleSubmit(template: WhatsAppTemplate) {
  submittingIds.value.add(template.id)
  const result = await submitTemplate(template.id)
  submittingIds.value.delete(template.id)
  if (result.success) {
    toast.success(`"${template.name}" was approved by Meta`)
  }
  else {
    toast.error(`"${template.name}" was rejected`, { description: template.statusReason ?? result.error })
  }
}

function handleDuplicate(template: WhatsAppTemplate) {
  const copy = duplicateTemplate(template.id)
  if (copy)
    toast.success(`"${copy.name}" duplicated`)
}

function handleDelete(template: WhatsAppTemplate) {
  deleteTemplate(template.id)
  toast.success(`"${template.name}" deleted`)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const filterOptions = computed(() => {
  const all: { key: 'all' | TemplateStatus, label: string } = { key: 'all', label: `All (${templates.value.length})` }
  const status = Object.entries(statusMeta).map(([key, meta]) => ({
    key: key as TemplateStatus,
    label: `${meta.label} (${statusCounts.value[key as TemplateStatus]})`,
  }))
  return [all, ...status]
})

const activeFilterLabel = computed(() => {
  return filterOptions.value.find(o => o.key === activeTab.value)?.label ?? 'All'
})
</script>

<template>
  <div
    class="flex flex-col overflow-hidden"
    :class="compact ? 'gap-3' : 'h-full'"
  >
    <!-- Header -->
    <div
      v-if="!compact"
      class="flex items-start justify-between gap-4 border-b bg-background px-6 py-5"
    >
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          WhatsApp Templates
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">
          Build and manage Meta-approved message templates for Journey automations.
        </p>
      </div>
      <Button :disabled="!isConnected" @click="emit('createTemplate')">
        <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
        New Template
      </Button>
    </div>

    <!-- WABA not connected -->
    <div
      v-if="!isConnected"
      class="flex flex-1 flex-col items-center justify-center p-6 text-center"
    >
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/10">
        <Icon name="logos:whatsapp-icon" class="h-8 w-8" />
      </div>
      <h3 class="text-lg font-semibold">
        Connect WhatsApp Business
      </h3>
      <p class="mt-1 mb-5 max-w-sm text-sm text-muted-foreground">
        You need a connected WhatsApp Business Account before you can create and submit templates.
      </p>
      <Button as-child>
        <NuxtLink to="/settings/integrations">
          Connect WhatsApp Business
        </NuxtLink>
      </Button>
    </div>

    <template v-else>
      <!-- Filters -->
      <div
        class="border-b"
        :class="compact ? 'px-1 py-2' : 'px-6 py-3'"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">Status</span>
            <Select
              :model-value="activeTab"
              @update:model-value="(v) => activeTab = (v as TemplateStatus | 'all')"
            >
              <SelectTrigger class="h-8 w-[180px] text-xs">
                <SelectValue :placeholder="activeFilterLabel">
                  {{ activeFilterLabel }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in filterOptions"
                  :key="option.key"
                  :value="option.key"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center gap-2">
            <div class="relative w-full sm:w-56">
              <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="search"
                placeholder="Search templates..."
                class="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              :disabled="!isConnected"
              class="h-9 gap-1.5"
              @click="emit('createTemplate')"
            >
              <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
              New Template
            </Button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div
        class="flex-1 overflow-y-auto"
        :class="compact ? 'p-1' : 'p-6'"
      >
        <!-- Empty state -->
        <div v-if="filteredTemplates.length === 0" class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Icon name="i-lucide-message-square-plus" class="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
          <h3 class="text-lg font-semibold">
            No templates yet
          </h3>
          <p class="mt-1 mb-5 max-w-sm text-sm text-muted-foreground">
            Create your first WhatsApp template to use it in Journey automations.
          </p>
          <Button @click="emit('createTemplate')">
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>

        <!-- Table -->
        <div v-else class="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[280px]">
                  Name
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="w-[130px]">
                  Last Modified
                </TableHead>
                <TableHead class="w-[56px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="template in paginatedTemplates" :key="template.id">
                <TableCell class="font-medium">
                  <div class="flex flex-col">
                    <span>{{ template.name }}</span>
                    <span v-if="template.qualityRating" class="text-[10px] text-muted-foreground">
                      Quality: {{ template.qualityRating }}
                    </span>
                  </div>
                </TableCell>
                <TableCell class="capitalize">
                  {{ template.category }}
                </TableCell>
                <TableCell>
                  {{ template.language.toUpperCase() }}
                </TableCell>
                <TableCell>
                  <TooltipProvider :delay-duration="100">
                    <Tooltip v-if="template.status === 'rejected' && template.statusReason">
                      <TooltipTrigger as-child>
                        <Badge :variant="statusMeta[template.status].variant" class="cursor-help">
                          {{ statusMeta[template.status].label }}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" class="max-w-sm">
                        <p class="text-xs">
                          {{ template.statusReason }}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <Badge v-else :variant="statusMeta[template.status].variant">
                      {{ statusMeta[template.status].label }}
                    </Badge>
                  </TooltipProvider>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ formatDate(template.lastModified) }}
                </TableCell>
                <TableCell class="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" aria-label="Template actions">
                        <Icon name="i-lucide-ellipsis" class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="emit('editTemplate', template)">
                        <Icon name="i-lucide-pencil" class="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="template.status === 'draft' || template.status === 'rejected'"
                        :disabled="submittingIds.has(template.id)"
                        @click="handleSubmit(template)"
                      >
                        <Icon name="i-lucide-send" class="mr-2 h-4 w-4" />
                        Submit for Review
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="handleDuplicate(template)">
                        <Icon name="i-lucide-copy" class="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive" @click="handleDelete(template)">
                        <Icon name="i-lucide-trash-2" class="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- Pagination -->
        <div
          class="flex items-center justify-between"
          :class="compact ? 'px-1 py-2' : 'px-2 py-3'"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">Rows per page</span>
            <Select
              :model-value="`${pageSize}`"
              @update:model-value="(v: any) => setPageSize(v)"
            >
              <SelectTrigger class="h-7 w-[68px] text-xs">
                <SelectValue :placeholder="`${pageSize}`" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem v-for="size in pageSizeOptions" :key="size" :value="`${size}`">
                  {{ size }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs font-medium">
              Page {{ pageIndex + 1 }} of {{ pageCount }}
            </span>
            <div class="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                :disabled="!canPrevPage"
                aria-label="First page"
                @click="firstPage"
              >
                <Icon name="i-lucide-chevrons-left" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                :disabled="!canPrevPage"
                aria-label="Previous page"
                @click="prevPage"
              >
                <Icon name="i-lucide-chevron-left" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                :disabled="!canNextPage"
                aria-label="Next page"
                @click="nextPage"
              >
                <Icon name="i-lucide-chevron-right" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                :disabled="!canNextPage"
                aria-label="Last page"
                @click="lastPage"
              >
                <Icon name="i-lucide-chevrons-right" class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Approved templates count -->
      <div
        class="border-t bg-muted/30 text-xs text-muted-foreground"
        :class="compact ? 'px-3 py-1.5' : 'px-6 py-2'"
      >
        {{ approvedTemplates.length }} approved template{{ approvedTemplates.length === 1 ? '' : 's' }} available in Journey steps
      </div>
    </template>
  </div>
</template>
