<script setup lang="ts">
import type { Website } from '~/components/website-builder/data/websites'
import { toast } from 'vue-sonner'
import { setWebsiteStatus, websites } from '~/components/website-builder/data/websites'

definePageMeta({
  layout: 'default',
})

const router = useRouter()

function openPreview(website: Website) {
  window.open(`https://${website.url}`, '_blank', 'noopener,noreferrer')
}

// Taking a live site off the internet is not something to do on a stray click, so it is
// confirmed. Publishing again is not — it only restores what the host already built.
const unpublishTarget = ref<Website | null>(null)

function confirmUnpublish() {
  const target = unpublishTarget.value
  if (!target)
    return
  setWebsiteStatus(target.id, 'draft')
  unpublishTarget.value = null
  toast.success(`${target.name} is no longer published`)
}

function publish(website: Website) {
  setWebsiteStatus(website.id, 'published')
  toast.success(`${website.name} is live at ${website.url}`)
}

function statusBadgeClass(status: Website['status']) {
  switch (status) {
    case 'published':
      return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20'
    case 'draft':
      return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
    case 'building':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20'
    default:
      return ''
  }
}

function statusLabel(status: Website['status']) {
  switch (status) {
    case 'published':
      return 'Published'
    case 'draft':
      return 'Draft'
    case 'building':
      return 'Building'
    default:
      return status
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatVisits(num: number) {
  if (num >= 1000)
    return `${(num / 1000).toFixed(1)}k`
  return num.toString()
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold tracking-tight">
        Website Builder
      </h2>
      <Button as-child>
        <NuxtLink to="/website-builder/create">
          <Icon name="i-lucide-plus" class="size-4 mr-2" />
          Create Website
        </NuxtLink>
      </Button>
    </div>

    <main v-if="websites.length > 0" class="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
      <Card v-for="website in websites" :key="website.id" class="@container/card">
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <CardTitle class="text-lg font-semibold">
              {{ website.name }}
            </CardTitle>
            <Badge :class="statusBadgeClass(website.status)">
              {{ statusLabel(website.status) }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="i-lucide-globe" class="size-4" />
            <span>{{ website.url }}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="i-lucide-layout-template" class="size-4" />
            <span>{{ website.template }}</span>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-border">
            <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon name="i-lucide-bar-chart-3" class="size-4" />
              <span>{{ formatVisits(website.visits) }} visits/mo</span>
            </div>
            <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon name="i-lucide-clock" class="size-4" />
              <span>{{ formatDate(website.lastUpdated) }}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter class="gap-2 pt-0">
          <Button variant="outline" size="sm" class="flex-1" @click="router.push(`/website-builder/create?edit=${website.id}`)">
            <Icon name="i-lucide-pencil" class="size-4 mr-1.5" />
            Edit
          </Button>
          <Button variant="outline" size="sm" class="flex-1" @click="openPreview(website)">
            <Icon name="i-lucide-external-link" class="size-4 mr-1.5" />
            Preview
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="icon" class="size-8" :aria-label="`More actions for ${website.name}`">
                <Icon name="i-lucide-ellipsis-vertical" class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                v-if="website.status === 'published'"
                :data-testid="`unpublish-${website.id}`"
                @select="unpublishTarget = website"
              >
                <Icon name="i-lucide-eye-off" class="size-4" />
                Unpublish
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else-if="website.status === 'draft'"
                :data-testid="`publish-${website.id}`"
                @select="publish(website)"
              >
                <Icon name="i-lucide-rocket" class="size-4" />
                Publish
              </DropdownMenuItem>
              <DropdownMenuItem v-else disabled>
                <Icon name="i-lucide-loader" class="size-4" />
                Building…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    </main>

    <main v-else class="flex flex-1 items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="i-lucide-globe" class="size-6" />
          </EmptyMedia>
          <EmptyTitle>Website Builder</EmptyTitle>
          <EmptyDescription>
            Create and manage your property listing websites. Build beautiful, responsive sites to showcase your vacation rentals and attract more guests.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button as-child>
            <NuxtLink to="/website-builder/create">
              <Icon name="i-lucide-plus" class="size-4 mr-2" />
              Create Your First Website
            </NuxtLink>
          </Button>
        </EmptyContent>
      </Empty>
    </main>

    <AlertDialog :open="unpublishTarget !== null" @update:open="(open: boolean) => { if (!open) unpublishTarget = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unpublish {{ unpublishTarget?.name }}?</AlertDialogTitle>
          <AlertDialogDescription>
            Visitors to {{ unpublishTarget?.url }} will no longer see the site. Nothing is
            deleted — its pages, review rules and properties are kept, and you can publish it
            again at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm-unpublish" @click="confirmUnpublish">
            Unpublish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
