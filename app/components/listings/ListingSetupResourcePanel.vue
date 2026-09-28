<script setup lang="ts">
import type { Listing, ListingDocument } from '~/components/listings/data/listings'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'

const props = defineProps<{ listing: Listing }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const fileInputEl = ref<HTMLInputElement | null>(null)
const MAX_DOCS = 20
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']

function uploadDocs(files: FileList | null) {
  if (!files)
    return
  const remaining = MAX_DOCS - props.listing.resources.documents.length
  Array.from(files).slice(0, remaining).forEach((file) => {
    if (!ALLOWED.includes(file.type) || file.size > MAX_SIZE)
      return
    const reader = new FileReader()
    reader.onload = (e) => {
      const doc: ListingDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        url: e.target?.result as string,
        size: file.size,
        uploadedAt: new Date().toISOString().split('T')[0]!,
      }
      emit('update', { ...props.listing, resources: { ...props.listing.resources, documents: [...props.listing.resources.documents, doc] } })
    }
    reader.readAsDataURL(file)
  })
}

function deleteDoc(id: string) {
  emit('update', { ...props.listing, resources: { ...props.listing.resources, documents: props.listing.resources.documents.filter(d => d.id !== id) } })
}

function downloadDoc(doc: ListingDocument) {
  if (!doc.url)
    return
  const a = document.createElement('a')
  a.href = doc.url
  a.download = doc.name
  a.click()
}

function formatSize(bytes: number) {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isAutoFilling = ref(false)

async function autoFill() {
  isAutoFilling.value = true
  await new Promise(r => setTimeout(r, 1500))
  const filled = {
    ...props.listing.resources.basics,
    description: props.listing.resources.basics.description || `${props.listing.name} is a beautiful ${props.listing.room} in ${props.listing.location}, accommodating up to ${props.listing.capacity} guests.`,
    checkInTime: props.listing.resources.basics.checkInTime || '14:00',
    checkOutTime: props.listing.resources.basics.checkOutTime || '11:00',
  }
  emit('update', { ...props.listing, resources: { ...props.listing.resources, basics: filled } })
  isAutoFilling.value = false
  toast.success('Property details auto-filled from resources')
}

const showCopyDialog = ref(false)
const copySearch = ref('')
const otherListings = computed(() => listings.value.filter(l => l.id !== props.listing.id))
const filteredCopyListings = computed(() => {
  if (!copySearch.value)
    return otherListings.value
  return otherListings.value.filter(l => l.name.toLowerCase().includes(copySearch.value.toLowerCase()))
})

function copyFromProperty(sourceId: string) {
  const source = listings.value.find(l => l.id === sourceId)
  if (!source)
    return
  emit('update', { ...props.listing, resources: JSON.parse(JSON.stringify(source.resources)) })
  toast.success('Resources copied from property')
  showCopyDialog.value = false
  copySearch.value = ''
}

// AI document generation
const showAiDialog = ref(false)
const aiPrompt = ref('')
const aiGenerated = ref('')
const isAiGenerating = ref(false)

const aiPromptExamples = [
  'House rules for guests',
  'WiFi & tech instructions',
  'Check-in & check-out guide',
  'Kitchen & appliance guide',
  'Local restaurant recommendations',
  'Emergency contacts & safety info',
]

function openAiDialog() {
  aiPrompt.value = ''
  aiGenerated.value = ''
  showAiDialog.value = true
}

function pickExample(example: string) {
  aiPrompt.value = example
}

async function generateAiDocument() {
  if (!aiPrompt.value.trim())
    return
  isAiGenerating.value = true
  aiGenerated.value = ''
  await new Promise(r => setTimeout(r, 1500))
  aiGenerated.value = buildMockDocument(aiPrompt.value, props.listing)
  isAiGenerating.value = false
}

function buildMockDocument(prompt: string, listing: Listing): string {
  const amenities = listing.amenities.length ? listing.amenities.join(', ') : 'the usual amenities'
  const unitTypes = (listing.unitTypes ?? []).map(ut => ut.name).join(', ') || 'rooms'
  const checkIn = listing.resources.basics.checkInTime || '14:00'
  const checkOut = listing.resources.basics.checkOutTime || '11:00'
  const slug = prompt.toLowerCase()

  if (slug.includes('house rule')) {
    return `${listing.name} — House Rules\n${'='.repeat(40)}\n\nWelcome to ${listing.name} in ${listing.location}. To ensure a pleasant stay for everyone, please observe the following house rules:\n\n1. Check-in is from ${checkIn}; check-out is by ${checkOut}.\n2. ${listing.capacity} guests maximum across all ${unitTypes}.\n3. No smoking inside the property.\n4. Quiet hours: 22:00 – 08:00.\n5. Please respect the neighbours and the local community.\n6. Dispose of trash in the designated bins.\n7. Report any damage or issues promptly to your host.\n\nWe hope you enjoy your stay!`
  }
  if (slug.includes('wifi') || slug.includes('tech')) {
    return `${listing.name} — WiFi & Tech Instructions\n${'='.repeat(40)}\n\nNetwork: ${listing.name.replace(/\s+/g, '_')}_Guest\nPassword: elev8welcome2026\n\n• 2.4GHz and 5GHz networks are broadcast under the same SSID.\n• Router is located in the living area. Please do not reset.\n• Smart TV remotes are in the top drawer of the TV unit.\n• Air-conditioning is controlled via the wall-mounted thermostat in each room.\n• Power outlets: Type C / F (European standard).\n\nFor any connectivity issues, message your host on Elev8.`
  }
  if (slug.includes('check-in') || slug.includes('check out') || slug.includes('check-in & check-out')) {
    return `${listing.name} — Check-in & Check-out Guide\n${'='.repeat(40)}\n\nCheck-in: from ${checkIn}\nCheck-out: by ${checkOut}\n\nBefore arrival:\n• Send your estimated arrival time 24 hours in advance.\n• Photo ID will be required at check-in.\n\nArrival:\n• The property is located in ${listing.location}.\n• Lockbox code will be sent the morning of your arrival.\n• If you need an early check-in or late check-out, message your host — we will do our best to accommodate.\n\nDeparture:\n• Please start the dishwasher and take out the trash before you leave.\n• Leave the keys on the kitchen counter.\n• We hope you had a wonderful stay!`
  }
  if (slug.includes('kitchen') || slug.includes('appliance')) {
    return `${listing.name} — Kitchen & Appliance Guide\n${'='.repeat(40)}\n\nThe kitchen is fully equipped with:\n• Stove, oven, microwave, refrigerator, freezer\n• Coffee maker (French press + drip)\n• Kettle, toaster, blender\n• Pots, pans, utensils, dinnerware\n• Basic pantry items (salt, pepper, oil)\n\nAppliance quick-start:\n• Oven: turn the bottom-right knob to "Bake" and set the temperature on the digital display.\n• Dishwasher: press the top button twice to start a normal cycle.\n• Coffee maker: 1 scoop per cup, fresh water in the back.\n\nPlease do not move the refrigerator — it is plumbed in.`
  }
  if (slug.includes('restaurant') || slug.includes('food') || slug.includes('local')) {
    return `${listing.name} — Local Recommendations\n${'='.repeat(40)}\n\nHere are some favourite spots near ${listing.location}:\n\n🍽️ Warung Bu Mi — 5 min drive\n   Authentic Balinese cuisine, very affordable.\n\n🍕 Crate Café — 10 min drive\n   Great brunch and coffee, popular with expats.\n\n🍣 Sushi Tei — 12 min drive\n   Family-friendly Japanese, large portions.\n\n🍦 Gusto Gelato — 8 min drive\n   Best gelato in the area, open until late.\n\n🌅 Old Man's Beachfront Bar — 15 min drive\n   Sunset cocktails with live music on weekends.\n\nPro tip: try the local warungs for the most authentic (and most affordable) meals.`
  }
  if (slug.includes('emergency') || slug.includes('safety')) {
    return `${listing.name} — Emergency & Safety Information\n${'='.repeat(40)}\n\nImportant numbers:\n• Police: 110\n• Ambulance: 118\n• Fire: 113\n• Tourist Police: +62 361 224 111\n\nNearest hospital:\nBali International Medical Centre (BIMC) — 20 min drive\nJl. Bypass Ngurah Rai No.100X, Kuta\nPhone: +62 361 761 263\n\nNearest clinic:\nBaliMed — 10 min drive\nOpen 24/7 for minor issues\n\nProperty safety:\n• Smoke detectors in every bedroom and the kitchen.\n• Fire extinguisher under the kitchen sink.\n• First-aid kit in the bathroom cabinet.\n• Emergency exits are marked with green signs.\n\nFor non-urgent assistance, message your host on Elev8.`
  }
  // Generic fallback
  const title = prompt.charAt(0).toUpperCase() + prompt.slice(1)
  return `${listing.name} — ${title}\n${'='.repeat(40)}\n\nThis document was generated by Elev8 AI for ${listing.name}, a ${listing.room} in ${listing.location} accommodating up to ${listing.capacity} guests.\n\nProperty amenities include: ${amenities}.\n\n${prompt}\n\nPlease feel free to reach out to your host on Elev8 for any questions during your stay. We hope you enjoy ${listing.location}!`
}

function saveAiDocument() {
  if (!aiGenerated.value.trim())
    return
  const fileName = `${aiPrompt.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.txt`
  const blob = new Blob([aiGenerated.value], { type: 'text/plain' })
  const reader = new FileReader()
  reader.onload = (e) => {
    const doc: ListingDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: fileName || 'ai-document.txt',
      url: e.target?.result as string,
      size: blob.size,
      uploadedAt: new Date().toISOString().split('T')[0]!,
    }
    emit('update', { ...props.listing, resources: { ...props.listing.resources, documents: [...props.listing.resources.documents, doc] } })
    toast.success('AI document added to property documents')
    showAiDialog.value = false
    aiPrompt.value = ''
    aiGenerated.value = ''
  }
  reader.readAsDataURL(blob)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 border-b flex-shrink-0 flex items-center" style="height: calc(36px + 1.5rem)">
      <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resources</span>
    </div>

    <ScrollArea class="flex-1 min-h-0">
      <div class="flex flex-col gap-4 p-4">
        <div class="flex flex-col gap-2">
          <div class="text-sm font-semibold">
            Property Documents
          </div>
          <p class="text-xs text-muted-foreground">
            All documents are used automatically by Elev8 AI
          </p>

          <div v-for="doc in listing.resources.documents" :key="doc.id" class="flex items-center gap-2 rounded-lg border p-2.5">
            <Icon name="lucide:file-text" class="size-4 text-amber-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium truncate">
                {{ doc.name }}
              </p>
              <p class="text-[10px] text-muted-foreground">
                {{ formatSize(doc.size) }}
              </p>
            </div>
            <Button variant="ghost" size="icon" class="size-7 shrink-0" @click="downloadDoc(doc)">
              <Icon name="lucide:download" class="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="size-7 shrink-0 hover:text-destructive" @click="deleteDoc(doc.id)">
              <Icon name="lucide:x" class="size-3.5" />
            </Button>
          </div>

          <Button variant="outline" size="sm" class="w-full gap-1.5 border-dashed" @click="fileInputEl?.click()">
            <Icon name="lucide:plus" class="size-3.5" />
            Upload New Document
          </Button>
          <input
            ref="fileInputEl" type="file" accept=".pdf,.docx,.txt" multiple class="hidden"
            @change="uploadDocs(($event.target as HTMLInputElement).files)"
          >

          <div class="flex items-center gap-1.5 pt-1">
            <div class="flex-1 h-px bg-border" />
            <span class="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
            <div class="flex-1 h-px bg-border" />
          </div>

          <Button
            class="w-full gap-1.5"
            :disabled="listing.resources.documents.length >= MAX_DOCS"
            @click="openAiDialog"
          >
            <Icon name="elev8:elevai" class="size-3.5" />
            Generate with AI
          </Button>
        </div>

        <Separator />

        <div class="flex flex-col gap-2">
          <div class="text-sm font-semibold">
            Elev8 AI
          </div>
          <div class="text-xs text-muted-foreground font-medium">
            Property Integration
          </div>
          <div class="flex flex-col gap-1.5">
            <div v-for="item in ['Property details', 'Property availability and pricing', 'Guest and reservation data', 'Past conversations (last 6 months)']" :key="item" class="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="lucide:check" class="size-3.5 text-green-500 shrink-0" />
              {{ item }}
            </div>
          </div>
        </div>

        <Separator />

        <div class="flex flex-col gap-2">
          <div class="text-sm font-semibold">
            Property Profile
          </div>
          <Button class="w-full gap-1.5" :disabled="isAutoFilling" @click="autoFill">
            <Icon v-if="isAutoFilling" name="lucide:loader-2" class="size-3.5 animate-spin" />
            <Icon v-else name="elev8:elevai" class="size-3.5" />
            {{ isAutoFilling ? 'Filling...' : 'Auto-Fill Property Details' }}
          </Button>
          <Button variant="outline" class="w-full gap-1.5" @click="showCopyDialog = true">
            <Icon name="lucide:copy" class="size-3.5" />
            Copy Data From Other Property
          </Button>
        </div>
      </div>
    </ScrollArea>

    <Dialog v-model:open="showCopyDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Copy From Property</DialogTitle>
          <DialogDescription>Copy resources from another listing.</DialogDescription>
        </DialogHeader>
        <div class="relative">
          <Icon name="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input v-model="copySearch" placeholder="Search listings..." class="pl-8" />
        </div>
        <ScrollArea class="max-h-60">
          <div class="flex flex-col gap-1">
            <div
              v-for="l in filteredCopyListings" :key="l.id"
              class="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-accent"
              @click="copyFromProperty(l.id)"
            >
              <div class="size-8 rounded overflow-hidden bg-muted shrink-0">
                <img :src="l.photos[0]" class="size-full object-cover">
              </div>
              <span class="text-sm truncate">{{ l.name }}</span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showAiDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon name="elev8:elevai" class="size-4" />
            Generate Document with AI
          </DialogTitle>
          <DialogDescription>
            Describe what document you need for {{ listing.name }} and Elev8 AI will draft it for you to review and save.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3 py-2">
          <div class="flex flex-col gap-1.5">
            <Label>What do you need?</Label>
            <Textarea
              v-model="aiPrompt"
              :disabled="isAiGenerating"
              rows="3"
              placeholder="e.g., House rules for guests, WiFi instructions, Check-in guide..."
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-xs text-muted-foreground">Or pick an example:</span>
            <div class="flex flex-wrap gap-1.5">
              <Button
                v-for="example in aiPromptExamples"
                :key="example"
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                :disabled="isAiGenerating"
                @click="pickExample(example)"
              >
                {{ example }}
              </Button>
            </div>
          </div>

          <div v-if="aiGenerated || isAiGenerating" class="flex flex-col gap-1.5">
            <Label>Generated preview</Label>
            <div class="relative">
              <Textarea
                v-model="aiGenerated"
                :disabled="isAiGenerating"
                rows="10"
                class="font-mono text-xs"
              />
              <div v-if="isAiGenerating" class="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md">
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="lucide:loader-2" class="size-4 animate-spin" />
                  Generating...
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" :disabled="isAiGenerating" @click="showAiDialog = false">
            Cancel
          </Button>
          <Button
            v-if="!aiGenerated"
            size="sm"
            :disabled="!aiPrompt.trim() || isAiGenerating"
            @click="generateAiDocument"
          >
            <Icon name="elev8:elevai" class="size-3.5 mr-1.5" />
            Generate
          </Button>
          <Button
            v-else
            size="sm"
            :disabled="isAiGenerating"
            @click="saveAiDocument"
          >
            <Icon name="lucide:check" class="size-3.5 mr-1.5" />
            Save Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
