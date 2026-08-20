<script setup lang="ts">
// Owner portal — Document Center view (Flow 10A). Lists only the documents
// the logged-in owner is allowed to see and lets them download each one.

import type { OwnerDocument } from '~/components/owners/data/owner-documents'
import { toast } from 'vue-sonner'
import { documentCategoryIcons, documentCategoryLabels } from '~/components/owners/data/owner-documents'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { useOwnerDocuments } from '~/composables/useOwnerDocuments'
import { useOwnerPortal } from '~/composables/useOwnerPortal'

definePageMeta({ layout: 'owner-portal' })

const { currentOwner } = useOwnerPortal()
const { getDocumentsForOwner, downloadDocument } = useOwnerDocuments()

const search = ref('')

const documents = computed<OwnerDocument[]>(() => {
  if (!currentOwner.value)
    return []
  const all = getDocumentsForOwner(currentOwner.value.id)
  const needle = search.value.trim().toLowerCase()
  if (!needle)
    return all
  return all.filter(doc =>
    doc.title.toLowerCase().includes(needle)
    || doc.category.toLowerCase().includes(needle))
})

function handleDownload(doc: OwnerDocument) {
  const result = downloadDocument(doc.id)
  if (!result.ok)
    toast.error(result.error)
  else
    toast.success(`Downloading ${result.fileName}`)
}
</script>

<template>
  <div class="flex h-[calc(100vh-9rem)] min-h-0 flex-col gap-4 p-4 sm:p-6 lg:p-8">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">
        Documents
      </h1>
      <p class="text-sm text-muted-foreground">
        Contracts, tax documents, insurance policies, and invoices shared with you.
      </p>
    </header>

    <div class="flex items-center gap-3">
      <div class="relative max-w-sm flex-1">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" class="pl-9" placeholder="Search documents…" />
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <Card v-if="!documents.length" class="flex h-full items-center justify-center">
        <CardContent class="text-center text-sm text-muted-foreground">
          No documents are available for your properties yet.
        </CardContent>
      </Card>

      <div v-else class="space-y-2">
        <div
          v-for="doc in documents"
          :key="doc.id"
          class="flex items-center justify-between gap-4 rounded-lg border p-4"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon :name="documentCategoryIcons[doc.category]" class="size-5 text-muted-foreground" />
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ doc.title }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ doc.fileName }} · v{{ doc.version }} · {{ new Date(doc.uploadedAt).toLocaleDateString() }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">
              {{ documentCategoryLabels[doc.category] }}
            </Badge>
            <Button size="sm" variant="outline" @click="handleDownload(doc)">
              <Icon name="lucide:download" class="mr-1 size-3.5" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
