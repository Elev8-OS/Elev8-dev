<script setup lang="ts">
// Document Center panel — embeddable version of the tenant document sharing
// surface. Rendered inside the Users page Owner tab; the /owner-documents
// route wraps the same component.

import type { OwnerDocument, OwnerDocumentCategory, OwnerDocumentVisibility } from '~/components/owners/data/owner-documents'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import {
  documentCategoryIcons,
  documentCategoryLabels,
  formatDocumentFileSize,
  OWNER_DOCUMENT_ACCEPT_ATTR,
  OWNER_DOCUMENT_ACCEPT_LABEL,
  OWNER_DOCUMENT_MAX_BYTES,
  validateOwnerDocumentFile,
} from '~/components/owners/data/owner-documents'
import { useOwnerDocuments } from '~/composables/useOwnerDocuments'
import { useOwners } from '~/composables/useOwners'

const { documents, uploadDocument, downloadDocument, audienceForDocument } = useOwnerDocuments()
const { owners } = useOwners()

const uploadOpen = ref(false)

// The picked file. Required by this form; `uploadDocument` itself stays
// file-optional so contracts can create their entry programmatically.
const uploadFile = ref<{ name: string, size: number, type: string, content: string } | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const fileError = ref('')
const maxFileSizeLabel = formatDocumentFileSize(OWNER_DOCUMENT_MAX_BYTES)

const uploadTitle = ref('')
const uploadCategory = ref<OwnerDocumentCategory>('contract')
const uploadVisibility = ref<OwnerDocumentVisibility>('all_owners')
const uploadOwnerId = ref<string>('')
const uploadListingId = ref<string>('')

const ownerById = computed(() => new Map(owners.value.map(o => [o.id, o])))
const listingById = computed(() => new Map(listings.value.map(l => [l.id, l])))

function visibilityLabel(doc: OwnerDocument): string {
  if (doc.visibility === 'specific_owner')
    return doc.ownerIds.map(id => ownerById.value.get(id)?.name ?? id).join(', ')
  return (doc.listingIds ?? []).map(id => listingById.value.get(id)?.name ?? id).join(', ')
}

function resetUpload() {
  uploadTitle.value = ''
  clearFile()
  uploadCategory.value = 'contract'
  uploadVisibility.value = 'all_owners'
  uploadOwnerId.value = ''
  uploadListingId.value = ''
}

/**
 * Read the picked file. Text-ish files keep their real body so the download
 * round-trips; binaries (PDF, images) fall back to the synthesized mock body,
 * because this demo has no blob storage.
 */
async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  const problem = validateOwnerDocumentFile(file)
  if (problem) {
    fileError.value = problem
    uploadFile.value = null
    input.value = ''
    return
  }
  fileError.value = ''
  const isText = file.type.startsWith('text/') || /\.(?:txt|csv|md|json)$/i.test(file.name)
  uploadFile.value = {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    content: isText ? await file.text() : '',
  }
  // Fill the title from the filename so picking a file is enough to submit.
  if (!uploadTitle.value.trim())
    uploadTitle.value = file.name.replace(/\.[^.]+$/, '')
}

function clearFile() {
  uploadFile.value = null
  fileError.value = ''
  if (fileInputRef.value)
    fileInputRef.value.value = ''
}

/** Why the Upload button is disabled, or null when it is ready. */
const uploadBlockedReason = computed<string | null>(() => {
  if (!uploadFile.value)
    return 'Choose a file to upload.'
  if (!uploadTitle.value.trim())
    return 'Add a title to upload.'
  if (uploadVisibility.value === 'specific_owner' && !uploadOwnerId.value)
    return 'Pick the owner who may see this document.'
  if (uploadVisibility.value === 'all_owners' && !uploadListingId.value)
    return 'Pick the listing whose owners may see this document.'
  return null
})

function submitUpload() {
  const result = uploadDocument({
    title: uploadTitle.value,
    category: uploadCategory.value,
    visibility: uploadVisibility.value,
    ownerIds: uploadVisibility.value === 'specific_owner' ? [uploadOwnerId.value] : undefined,
    listingIds: uploadVisibility.value === 'all_owners' ? (uploadListingId.value ? [uploadListingId.value] : undefined) : undefined,
    fileName: uploadFile.value?.name,
    fileSize: uploadFile.value?.size,
    mimeType: uploadFile.value?.type,
    content: uploadFile.value?.content || undefined,
  }, 'staff-1')
  if (!result.ok) {
    toast.error(result.error)
    return
  }
  // The owner portal has no notification surface — an owner discovers a new
  // document by opening their Documents page. Say what actually happens, and
  // name the audience so an upload with nobody to see it is obvious.
  const audience = audienceForDocument(result.document)
  if (audience.length === 0) {
    toast.warning('Document uploaded, but no owner is mapped to it yet — nobody can see it.')
  }
  else {
    toast.success(
      `Document uploaded — visible to ${audience.length} owner${audience.length === 1 ? '' : 's'} in their portal.`,
    )
  }
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
              <TableCell class="text-sm text-muted-foreground">
                {{ new Date(doc.uploadedAt).toLocaleDateString('en-GB') }}
              </TableCell>
              <TableCell class="text-right">
                <Button variant="ghost" size="sm" @click="handleDownload(doc)">
                  <Icon name="lucide:download" class="mr-1 size-3.5" />
                  Download
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
            <Label for="doc-file-panel">
              File <span class="text-destructive">*</span>
            </Label>
            <input
              id="doc-file-panel"
              ref="fileInputRef"
              type="file"
              :accept="OWNER_DOCUMENT_ACCEPT_ATTR"
              class="hidden"
              @change="onFilePicked"
            >
            <div v-if="uploadFile" class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <Icon name="lucide:paperclip" class="size-4 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm">
                  {{ uploadFile.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ formatDocumentFileSize(uploadFile.size) }}
                </p>
              </div>
              <Button variant="ghost" size="sm" aria-label="Remove file" @click="clearFile">
                <Icon name="lucide:x" class="size-4" />
              </Button>
            </div>
            <Button
              v-else
              variant="outline"
              class="w-full justify-start"
              :class="fileError ? 'border-destructive' : ''"
              @click="fileInputRef?.click()"
            >
              <Icon name="lucide:upload" class="mr-2 size-4" />
              Choose a file
            </Button>
            <p v-if="fileError" class="text-xs text-destructive">
              {{ fileError }}
            </p>
            <p v-else class="text-xs text-muted-foreground">
              {{ OWNER_DOCUMENT_ACCEPT_LABEL }} &middot; max {{ maxFileSizeLabel }}
            </p>
          </div>
          <div class="space-y-1.5">
            <Label for="doc-title-panel">
              Title <span class="text-destructive">*</span>
            </Label>
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
        <DialogFooter class="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p v-if="uploadBlockedReason" class="mr-auto text-xs text-muted-foreground">
            {{ uploadBlockedReason }}
          </p>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="uploadOpen = false">
              Cancel
            </Button>
            <Button :disabled="!!uploadBlockedReason" @click="submitUpload">
              Upload
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
