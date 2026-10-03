<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { isRichText, isRichTextEmpty, plainTextToHtml } from '~/lib/rich-text'

/**
 * A small WYSIWYG editor (TipTap) for guest guide text: bold, italic,
 * underline, lists and links, nothing else, matching the allowlist in
 * `app/lib/rich-text.ts`. Emits HTML, or '' when empty. Plain text from before
 * the editor existed opens as paragraphs.
 */
const props = defineProps<{ placeholder?: string, ariaLabel?: string }>()
const model = defineModel<string>({ default: '' })

function toEditorHtml(text: string) {
  return isRichText(text) ? text : plainTextToHtml(text)
}

const editor = useEditor({
  content: toEditorHtml(model.value),
  extensions: [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['mailto', 'tel'] },
    }),
    Placeholder.configure({ placeholder: props.placeholder ?? '' }),
  ],
  editorProps: {
    attributes: {
      'class': 'prose-guide min-h-16 px-3 py-2 text-xs focus:outline-none',
      'aria-label': props.ariaLabel ?? 'Text',
      'aria-multiline': 'true',
      'role': 'textbox',
    },
  },
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    model.value = isRichTextEmpty(html) ? '' : html
  },
})

// Content replaced from outside (an import, a template applied) reaches the editor.
watch(model, (value) => {
  const current = editor.value?.getHTML() ?? ''
  if (editor.value && value !== current && !(isRichTextEmpty(value) && isRichTextEmpty(current)))
    editor.value.commands.setContent(toEditorHtml(value), { emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())

// The TipTap instance, for a parent that needs to focus or command the editor.
defineExpose({ editor })

const linkOpen = ref(false)
const linkUrl = ref('')

function openLink() {
  linkUrl.value = editor.value?.getAttributes('link').href ?? ''
  linkOpen.value = true
}

function applyLink() {
  const url = linkUrl.value.trim()
  const chain = editor.value?.chain().focus().extendMarkRange('link')
  if (!chain)
    return
  if (url)
    chain.setLink({ href: /^(?:https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}` }).run()
  else
    chain.unsetLink().run()
  linkOpen.value = false
}

interface ToolbarButton {
  label: string
  icon: string
  active: () => boolean
  run: () => void
}

const buttons = computed<ToolbarButton[]>(() => {
  const e = editor.value
  if (!e)
    return []
  return [
    { label: 'Bold', icon: 'lucide:bold', active: () => e.isActive('bold'), run: () => e.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: 'lucide:italic', active: () => e.isActive('italic'), run: () => e.chain().focus().toggleItalic().run() },
    { label: 'Underline', icon: 'lucide:underline', active: () => e.isActive('underline'), run: () => e.chain().focus().toggleUnderline().run() },
    { label: 'Bulleted list', icon: 'lucide:list', active: () => e.isActive('bulletList'), run: () => e.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', icon: 'lucide:list-ordered', active: () => e.isActive('orderedList'), run: () => e.chain().focus().toggleOrderedList().run() },
  ]
})
</script>

<template>
  <div class="rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/50" data-testid="rich-text-editor">
    <div class="flex flex-wrap items-center gap-0.5 border-b px-1 py-1" role="toolbar" :aria-label="`${ariaLabel ?? 'Text'} formatting`">
      <button
        v-for="b in buttons"
        :key="b.label"
        type="button"
        class="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :class="b.active() ? 'bg-muted text-foreground' : ''"
        :aria-label="b.label"
        :aria-pressed="b.active()"
        :data-testid="`rte-${b.label.toLowerCase().replace(' ', '-')}`"
        @click="b.run()"
      >
        <Icon :name="b.icon" class="size-3.5" />
      </button>
      <Popover v-model:open="linkOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :class="editor?.isActive('link') ? 'bg-muted text-foreground' : ''"
            aria-label="Link"
            data-testid="rte-link"
            @click="openLink"
          >
            <Icon name="lucide:link" class="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-72 p-2">
          <form class="flex gap-2" @submit.prevent="applyLink">
            <Input v-model="linkUrl" placeholder="https://, mailto: or tel:" class="h-8 text-xs" aria-label="Link address" />
            <Button type="submit" size="sm" class="h-8">
              {{ linkUrl.trim() ? 'Apply' : 'Remove' }}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>
