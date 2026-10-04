<script setup lang="ts">
import type { HeaderType, WhatsAppTemplate } from './data/whatsapp-templates'
import { toast } from 'vue-sonner'
import {
  categoryMeta,
  generateButtonId,
  headerTypeMeta,
  insertableVariables,
  mapVariablesToPositional,
  templateLanguages,
  validateTemplate,
} from './data/whatsapp-templates'

const props = defineProps<{
  template: WhatsAppTemplate
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  save: [template: WhatsAppTemplate]
  submit: [template: WhatsAppTemplate]
  cancel: []
}>()

const local = ref<WhatsAppTemplate>(JSON.parse(JSON.stringify(props.template)))

watch(() => props.template, (newVal) => {
  local.value = JSON.parse(JSON.stringify(newVal))
}, { deep: true })

const validation = computed(() => validateTemplate(local.value))
const variableMapping = computed(() => mapVariablesToPositional(local.value.body).mapping)
const canSubmit = computed(() => {
  if (props.isSubmitting)
    return false
  if (!validation.value.valid)
    return false
  return ['draft', 'rejected'].includes(local.value.status)
})

const bodyTextarea = ref<any>(null)

function insertVariable(key: string) {
  const textareaEl = bodyTextarea.value?.$el instanceof HTMLTextAreaElement
    ? bodyTextarea.value.$el
    : (bodyTextarea.value as unknown as HTMLTextAreaElement | null)
  const before = local.value.body
  if (textareaEl && typeof textareaEl.selectionStart === 'number') {
    const start = textareaEl.selectionStart
    const end = textareaEl.selectionEnd ?? start
    local.value.body = `${before.slice(0, start)}{{${key}}}${before.slice(end)}`
    nextTick(() => {
      const pos = start + `{{${key}}}`.length
      textareaEl.setSelectionRange(pos, pos)
      textareaEl.focus()
    })
  }
  else {
    local.value.body = `${before}{{${key}}}`
  }
}

function setHeaderType(type: HeaderType) {
  local.value.header = { type }
}

function addButton(kind: WhatsAppTemplate['buttons'][number]['kind']) {
  const limit = kind === 'quick_reply' ? 3 : 2
  const count = local.value.buttons.filter(b => b.kind === kind).length
  if (count >= limit)
    return

  // Enforce one button type per template
  const otherKind = kind === 'quick_reply' ? 'cta' : 'quick'
  if (local.value.buttons.some(b => b.kind.startsWith(otherKind))) {
    toast.error('Choose either Quick Reply or Call-to-Action buttons, not both.')
    return
  }

  local.value.buttons = [...local.value.buttons, { id: generateButtonId(), kind, text: '' }]
}

function removeButton(id: string) {
  local.value.buttons = local.value.buttons.filter(b => b.id !== id)
}

function handleMediaFileChange(event: Event, type: HeaderType) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const url = URL.createObjectURL(file)
  local.value.header = {
    type,
    mediaUrl: url,
    mediaFilename: file.name,
  }
}

function handleSave() {
  emit('save', JSON.parse(JSON.stringify(local.value)))
}

function handleSubmit() {
  if (!canSubmit.value)
    return
  emit('submit', JSON.parse(JSON.stringify(local.value)))
}

const statusBanner = computed(() => {
  if (local.value.status === 'rejected' && local.value.statusReason) {
    return { variant: 'destructive' as const, title: 'Rejected by Meta', message: local.value.statusReason }
  }
  if (local.value.status === 'pending') {
    return { variant: 'default' as const, title: 'Pending review', message: 'Meta usually reviews templates within a few hours.' }
  }
  if (local.value.status === 'approved') {
    return { variant: 'default' as const, title: 'Approved', message: 'This template is live and can be used in Journeys.' }
  }
  return null
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header bar -->
    <header class="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" @click="emit('cancel')">
          <Icon name="i-lucide-arrow-left" class="h-4 w-4" />
        </Button>
        <div>
          <h1 class="text-lg font-semibold">
            {{ props.template.id ? 'Edit Template' : 'New Template' }}
          </h1>
          <p class="text-xs text-muted-foreground">
            Build a Meta-compliant WhatsApp message template
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" :disabled="isSubmitting" @click="handleSave">
          <Icon name="i-lucide-save" class="mr-1.5 h-4 w-4" />
          Save Draft
        </Button>
        <Button :disabled="!canSubmit" @click="handleSubmit">
          <Icon v-if="!isSubmitting" name="i-lucide-send" class="mr-1.5 h-4 w-4" />
          <Icon v-else name="i-lucide-loader-2" class="mr-1.5 h-4 w-4 animate-spin" />
          {{ isSubmitting ? 'Submitting…' : 'Submit for Review' }}
        </Button>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Form -->
      <div class="flex-1 overflow-y-auto p-4">
        <div class="mx-auto max-w-2xl space-y-5 pb-12">
          <!-- Status banner -->
          <Alert v-if="statusBanner" :variant="statusBanner.variant">
            <Icon name="i-lucide-info" class="h-4 w-4" />
            <AlertTitle>{{ statusBanner.title }}</AlertTitle>
            <AlertDescription>{{ statusBanner.message }}</AlertDescription>
          </Alert>

          <!-- Name + Category + Language -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="template-name">Template Name</Label>
              <Input
                id="template-name"
                v-model="local.name"
                placeholder="e.g. check_in_reminder"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="template-category">Category</Label>
              <Select v-model="local.category">
                <SelectTrigger id="template-category" class="justify-between">
                  <SelectValue class="sr-only">
                    {{ categoryMeta[local.category]?.label }}
                  </SelectValue>
                  <span aria-hidden="true">{{ categoryMeta[local.category]?.label }}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(meta, key) in categoryMeta"
                    :key="key"
                    :value="key"
                  >
                    <span class="flex flex-col">
                      <span>{{ meta.label }}</span>
                      <span class="text-[10px] text-muted-foreground leading-tight">{{ meta.description }}</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5 md:col-span-2">
              <Label for="template-language">Language</Label>
              <Select v-model="local.language">
                <SelectTrigger id="template-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="lang in templateLanguages"
                    :key="lang.code"
                    :value="lang.code"
                  >
                    {{ lang.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Header -->
          <div class="space-y-3 rounded-lg border p-4">
            <div class="flex items-center justify-between">
              <Label>Header</Label>
              <span class="text-xs text-muted-foreground">Optional</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="(meta, key) in headerTypeMeta"
                :key="key"
                class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                :class="local.header.type === key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'"
                @click="setHeaderType(key as HeaderType)"
              >
                {{ meta.label }}
              </button>
            </div>

            <div v-if="local.header.type === 'text'" class="space-y-1.5">
              <Input v-model="local.header.text" placeholder="Header text (max 60 chars)" maxlength="60" />
              <p class="text-xs text-muted-foreground text-right">
                {{ local.header.text?.length ?? 0 }}/60
              </p>
            </div>

            <div v-else-if="['image', 'video', 'document'].includes(local.header.type)" class="space-y-2">
              <div
                v-if="local.header.mediaUrl"
                class="relative rounded-md border bg-muted p-3"
              >
                <div class="flex items-center gap-2">
                  <Icon
                    :name="local.header.type === 'image' ? 'i-lucide-image' : local.header.type === 'video' ? 'i-lucide-video' : 'i-lucide-file-text'"
                    class="h-5 w-5 text-muted-foreground"
                  />
                  <span class="text-sm">{{ local.header.mediaFilename }}</span>
                  <button class="ml-auto text-muted-foreground hover:text-destructive" @click="setHeaderType(local.header.type)">
                    <Icon name="i-lucide-x" class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6"
              >
                <Icon name="i-lucide-upload-cloud" class="h-6 w-6 text-muted-foreground" />
                <p class="text-xs text-muted-foreground">
                  {{ headerTypeMeta[local.header.type].hint }}
                </p>
                <label class="cursor-pointer">
                  <Button variant="outline" size="sm" as="span" class="pointer-events-none">
                    Choose file
                  </Button>
                  <input
                    type="file"
                    class="hidden"
                    :accept="local.header.type === 'image' ? 'image/jpeg,image/png' : local.header.type === 'video' ? 'video/mp4' : 'application/pdf'"
                    @change="handleMediaFileChange($event, local.header.type)"
                  >
                </label>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div class="space-y-3 rounded-lg border p-4">
            <div class="flex items-center justify-between">
              <Label for="template-body">Body</Label>
              <span class="text-xs text-destructive">Required</span>
            </div>
            <Textarea
              id="template-body"
              ref="bodyTextarea"
              v-model="local.body"
              class="min-h-32 text-sm"
              placeholder="Write the message body..."
            />
            <div>
              <p class="mb-1.5 text-xs font-medium text-muted-foreground">
                Insert Field
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="v in insertableVariables"
                  :key="v.key"
                  class="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  @click="insertVariable(v.key)"
                >
                  {{ v.label }}
                </button>
              </div>
            </div>

            <!-- Variable mapping to Meta positional parameters -->
            <div v-if="Object.keys(variableMapping).length > 0" class="rounded-md border bg-muted/30 p-2.5">
              <p class="mb-1.5 text-xs font-medium text-muted-foreground">
                Meta Parameter Mapping
              </p>
              <div class="space-y-1">
                <div
                  v-for="positional in Object.keys(variableMapping).sort((a, b) => Number(a) - Number(b))"
                  :key="positional"
                  class="flex items-center gap-2 text-xs"
                >
                  <code class="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
                    {{ variableMapping[positional] }}
                  </code>
                  <Icon name="i-lucide-arrow-right" class="h-3 w-3 text-muted-foreground" />
                  <code class="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    &#123;&#123;{{ positional }}&#125;&#125;
                  </code>
                </div>
              </div>
              <p class="mt-1.5 text-[10px] text-muted-foreground">
                Mapping is based on the order each field first appears in the body.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="space-y-3 rounded-lg border p-4">
            <div class="flex items-center justify-between">
              <Label for="template-footer">Footer</Label>
              <span class="text-xs text-muted-foreground">Optional · Max 60 chars</span>
            </div>
            <Input
              id="template-footer"
              v-model="local.footer"
              placeholder="e.g. Elev8 Bali"
              maxlength="60"
            />
            <p class="text-xs text-muted-foreground text-right">
              {{ (local.footer ?? '').length }}/60
            </p>
          </div>

          <!-- Buttons -->
          <div class="space-y-3 rounded-lg border p-4">
            <div class="flex items-center justify-between">
              <Label>Buttons</Label>
              <span class="text-xs text-muted-foreground">Optional</span>
            </div>

            <div v-if="local.buttons.length > 0" class="space-y-2">
              <div
                v-for="btn in local.buttons"
                :key="btn.id"
                class="flex items-start gap-2 rounded-md border p-2"
              >
                <div class="flex-1 space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-muted-foreground w-20 shrink-0">
                      {{ btn.kind === 'quick_reply' ? 'Quick Reply' : btn.kind === 'cta_url' ? 'URL' : 'Phone' }}
                    </span>
                    <Input
                      v-model="btn.text"
                      placeholder="Button text (max 20)"
                      maxlength="20"
                      class="h-8 text-sm"
                    />
                  </div>
                  <Input
                    v-if="btn.kind === 'cta_url'"
                    v-model="btn.url"
                    placeholder="https://..."
                    class="h-8 text-sm"
                  />
                  <Input
                    v-if="btn.kind === 'cta_phone'"
                    v-model="btn.phoneNumber"
                    placeholder="+62 812 3456 7890"
                    class="h-8 text-sm"
                  />
                </div>
                <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" @click="removeButton(btn.id)">
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="local.buttons.some(b => b.kind !== 'quick_reply')"
                @click="addButton('quick_reply')"
              >
                <Icon name="i-lucide-plus" class="mr-1 h-3.5 w-3.5" />
                Quick Reply
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="local.buttons.some(b => b.kind === 'quick_reply')"
                @click="addButton('cta_url')"
              >
                <Icon name="i-lucide-plus" class="mr-1 h-3.5 w-3.5" />
                URL Button
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="local.buttons.some(b => b.kind === 'quick_reply')"
                @click="addButton('cta_phone')"
              >
                <Icon name="i-lucide-plus" class="mr-1 h-3.5 w-3.5" />
                Phone Button
              </Button>
            </div>
          </div>

          <!-- Validation panel -->
          <div class="rounded-lg border p-4">
            <div class="mb-2 flex items-center gap-2">
              <Icon
                :name="validation.valid ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
                class="h-4 w-4"
                :class="validation.valid ? 'text-green-600' : 'text-destructive'"
              />
              <span class="text-sm font-medium">
                {{ validation.valid ? 'Ready to submit' : 'Fix before submitting' }}
              </span>
            </div>
            <ul v-if="!validation.valid" class="space-y-1">
              <li
                v-for="(err, idx) in validation.errors"
                :key="idx"
                class="text-xs text-destructive"
              >
                {{ err.message }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div class="hidden w-[360px] shrink-0 border-l bg-background p-4 lg:block">
        <JourneysWhatsAppTemplatePreview :template="local" />
      </div>
    </div>
  </div>
</template>
