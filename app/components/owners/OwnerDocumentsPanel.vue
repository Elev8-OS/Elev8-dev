<script setup lang="ts">
// Document Center panel — embeddable version of the tenant document sharing
// surface. Rendered inside the Users page Owner tab; the /owner-documents
// route wraps the same component.

import type { OwnerDocument, OwnerDocumentCategory, OwnerDocumentVisibility } from '~/components/owners/data/owner-documents'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { documentCategoryIcons, documentCategoryLabels } from '~/components/owners/data/owner-documents'
import { useOwnerDocuments } from '~/composables/useOwnerDocuments'
import { useOwners } from '~/composables/useOwners'

const { documents, uploadDocument, downloadDocument, getDocumentHistory } = useOwnerDocuments()
const { owners } = useOwners()

const uploadOpen = ref(false)
const historyDocId = ref<string | null>(null)

const uploadTitle = ref('')
const uploadCategory = ref<OwnerDocumentCategory>('contract')
const uploadVisibility = ref<OwnerDocumentVisibility>('all_owners')
const uploadOwnerId = ref<string>('')
const uploadListingId = ref<string>('')

const historyDocuments = computed<OwnerDocument[]>(() =>
  historyDocId.value ? getDocumentHistory(historyDocId.value) : [])

const ownerById = computed(() => new Map(owners.value.map(o => [o.id, o])))
const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

function visibilityLabel(doc: OwnerDocument): string {
  if (doc.visibility === 'specific_owner')
    return doc.ownerIds.map(id => ownerById.value.get(id)?.name ?? id).join(', ')
  return (doc.listingIds ?? []).map(id => listingById.value.get(id)?.name ?? id).join(', ')
}

function resetUpload() {
  uploadTitle.value = ''
  uploadCategory.value = 'contract'
  uploadVisibility.value = 'all_owners'
  uploadOwnerId.value = ''
  uploadListingId.value = ''
}

function submitUpload() {
  const result = uploadDocument({
    title: uploadTitle.value,
    category: uploadCategory.value,
    visibility: uploadVisibility.value,
    ownerIds: uploadVisibility.value === 'specific_owner' ? [uploadOwnerId.value] : undefined,
    listingIds: uploadVisibility.value === 'all_owners' ? (uploadListingId.value ? [uploadListingId.value] : undefined) : undefined,
  }, 'staff-1')
  if (!result.ok) {
    toast.error(result.error)
    return
  }
  toast.success('Document uploaded and owners notified.')
  uploadOpen.value = false
  resetUpload()
}

function handleDownload(doc: OwnerDocument) {
  const result = downloadDocument(doc.id)
  if (!result.ok)
    toast.error(result.error)
  else
    toast.success(`Downloading ${result.fileName}`)
}

function openHistory(doc: OwnerDocument) {
  historyDocId.value = doc.id
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold tracking-tight">
          Document Center
        </h1>
        <p class="text-sm text-muted-foreground">
          Share contracts, tax documents, insurance policies, and invoices with owners.
        </p>
      </div>
      <Button @click="uploadOpen = true">
        <Icon name="lucide:plus" class="mr-2 size-4" />
        Upload document
      </Button>
    </div>

    <Card>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Visible to</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead class="text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="doc in documents" :key="doc.id">
              <TableCell>
                <div class="flex items-center gap-3">
                  <Icon :name="documentCategoryIcons[doc.category]" class="size-4 text-muted-foreground" />
                  <div>
                    <p class="font-medium">
                      {{ doc.title }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ doc.fileName }}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {{ documentCategoryLabels[doc.category] }}
                </Badge>
              </TableCell>
              <TableCell class="max-w-64 truncate text-sm text-muted-foreground">
                {{ visibilityLabel(doc) }}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  v{{ doc.version }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ new Date(doc.uploadedAt).toLocaleDateString() }}
              </TableCell>
              <TableCell class="text-right">
                <Button variant="ghost" size="sm" @click="handleDownload(doc)">
                  <Icon name="lucide:download" class="mr-1 size-3.5" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" @click="openHistory(doc)">
                  History
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog v-model:open="uploadOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Categorize the document and choose who can see it. Specific-owner documents are never visible to co-owners.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label for="doc-title-panel">Title</Label>
            <Input id="doc-title-panel" v-model="uploadTitle" placeholder="e.g. Management Agreement 2026" />
          </div>
          <div class="space-y-1.5">
            <Label>Category</Label>
            <Select v-model="uploadCategory">
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, key) in documentCategoryLabels" :key="key" :value="key">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-1.5">
            <Label>Visibility</Label>
            <Select v-model="uploadVisibility">
              <SelectTrigger>
                <SelectValue placeholder="Who can see this?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_owners">
                  All owners of selected listing(s)
                </SelectItem>
                <SelectItem value="specific_owner">
                  Specific owner only
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="uploadVisibility === 'specific_owner'" class="space-y-1.5">
            <Label for="doc-owner-panel">Owner</Label>
            <Select v-model="uploadOwnerId">
              <SelectTrigger>
                <SelectValue placeholder="Pick an owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="owner in owners" :key="owner.id" :value="owner.id">
                  {{ owner.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-else class="space-y-1.5">
            <Label for="doc-listing-panel">Listing</Label>
            <Select v-model="uploadListingId">
              <SelectTrigger>
                <SelectValue placeholder="Pick a listing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="listing in listings" :key="listing.id" :value="listing.id">
                  {{ listing.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="uploadOpen = false">
            Cancel
          </Button>
          <Button :disabled="!uploadTitle.trim()" @click="submitUpload">
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="!!historyDocId" @update:open="(v: boolean) => { if (!v) historyDocId = null }">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Revisions are preserved — old versions are never deleted.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <div
            v-for="(doc, index) in historyDocuments"
            :key="doc.id"
            class="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <p class="text-sm font-medium">
                v{{ doc.version }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ doc.fileName }} · {{ new Date(doc.uploadedAt).toLocaleString() }}
              </p>
            </div>
            <Button variant="ghost" size="sm" :disabled="index === historyDocuments.length - 1" @click="handleDownload(doc)">
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
