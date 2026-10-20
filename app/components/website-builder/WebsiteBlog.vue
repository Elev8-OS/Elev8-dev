<script setup lang="ts">
import type { BlogCover, BlogPost } from '~/components/website-builder/data/blog'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import {
  canPublish,
  draftTranslation,
  emptyPost,
  generateCover,
  generatePost,
  isTranslated,
  missingLanguages,
  postTitle,
} from '~/components/website-builder/data/blog'
import { LANGUAGE_OPTIONS } from '~/components/website-builder/data/wizard'

const emit = defineEmits<{
  /** Posts live on the website, so a saved post is a saved website. */
  save: [message: string]
}>()

const settings = defineModel<WebsiteSettings>('settings', { required: true })

const posts = computed(() => settings.value.blogPosts ?? [])
const languages = computed(() => settings.value.languages ?? ['en'])
const defaultLanguage = computed(() => settings.value.defaultLanguage ?? languages.value[0] ?? 'en')
const siteName = computed(() => settings.value.name)
const label = (code: string) => LANGUAGE_OPTIONS.find(l => l.code === code)?.label ?? code.toUpperCase()

function setPosts(next: BlogPost[]) {
  settings.value = { ...settings.value, blogPosts: next }
}

const sorted = computed(() => [...posts.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// ── AI generate ──
const SUGGESTIONS = ['Best time to visit Bali', 'Things to do nearby', 'Why book direct', 'Our favourite local restaurants']
const aiOpen = ref(false)
const topic = ref('')
const generating = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function openAi() {
  topic.value = ''
  aiOpen.value = true
}
function runGenerate() {
  if (!topic.value.trim() || generating.value)
    return
  generating.value = true
  timer = setTimeout(() => {
    generating.value = false
    aiOpen.value = false
    startEditing(generatePost(topic.value, siteName.value, languages.value), true)
  }, 1200)
}
onBeforeUnmount(() => clearTimeout(timer))

// ── Editor ──
const editing = ref<BlogPost | null>(null)
const isNew = ref(false)
const activeLang = ref(defaultLanguage.value)
const translating = ref<string | null>(null)

// ── Cover picture: made by the AI or picked by hand ──
const coverBusy = ref(false)
let coverSeed = 0
function aiCover() {
  const post = editing.value
  if (!post || coverBusy.value)
    return
  coverBusy.value = true
  coverSeed++
  setTimeout(() => {
    coverBusy.value = false
    if (editing.value)
      editing.value.cover = generateCover(editing.value.topic || postTitle(editing.value, defaultLanguage.value), coverSeed)
  }, 900)
}
function pickCover(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  const reader = new FileReader()
  reader.onload = () => {
    if (editing.value)
      editing.value.cover = { url: String(reader.result), name: file.name, source: 'upload' } satisfies BlogCover
  }
  reader.readAsDataURL(file)
}
function removeCover() {
  if (editing.value)
    editing.value.cover = undefined
}

function startEditing(post: BlogPost, created: boolean) {
  const copy = JSON.parse(JSON.stringify(post)) as BlogPost
  // Every site language gets its fields up front, so the form never adds keys while rendering.
  for (const code of languages.value)
    copy.translations[code] ??= { title: '', excerpt: '', body: '' }
  editing.value = copy
  isNew.value = created
  activeLang.value = defaultLanguage.value
}
function newPost() {
  startEditing(emptyPost(), true)
}

const field = (code: string) => editing.value!.translations[code]!

// Writes this language from the post's topic (the title when there is none). Demo engine, nothing is sent.
function translate(code: string) {
  const post = editing.value
  if (!post || translating.value)
    return
  translating.value = code
  setTimeout(() => {
    translating.value = null
    if (!editing.value)
      return
    const source = editing.value.topic || postTitle(editing.value, defaultLanguage.value)
    editing.value.translations[code] = draftTranslation(source, siteName.value, code)
    editing.value.aiGenerated = true
  }, 800)
}
function translateMissing() {
  const post = editing.value
  if (!post)
    return
  const source = post.topic || postTitle(post, defaultLanguage.value)
  for (const code of missingLanguages(post, languages.value))
    post.translations[code] = draftTranslation(source, siteName.value, code)
  post.aiGenerated = true
}

const missing = computed(() => editing.value ? missingLanguages(editing.value, languages.value) : [])
const publishable = computed(() => !!editing.value && canPublish(editing.value, defaultLanguage.value))

// The save reads the website back from the parent, so it waits for the new posts to reach it.
async function savePost() {
  const post = editing.value
  if (!post)
    return
  if (post.status === 'published' && !publishable.value)
    post.status = 'draft'
  const saved = { ...post, updatedAt: new Date().toISOString() }
  setPosts(posts.value.some(p => p.id === saved.id) ? posts.value.map(p => p.id === saved.id ? saved : p) : [saved, ...posts.value])
  editing.value = null
  await nextTick()
  emit('save', saved.status === 'published' ? 'Post published' : 'Post saved as draft')
}

// Publish or unpublish straight from the list.
async function togglePublish(post: BlogPost) {
  const publishing = post.status !== 'published'
  if (publishing && !canPublish(post, defaultLanguage.value))
    return
  const next: BlogPost = { ...post, status: publishing ? 'published' : 'draft', updatedAt: new Date().toISOString() }
  setPosts(posts.value.map(p => p.id === post.id ? next : p))
  await nextTick()
  emit('save', publishing ? 'Post published' : 'Post unpublished. It is a draft again')
}

const deleting = ref<BlogPost | null>(null)
async function deletePost() {
  const post = deleting.value
  if (!post)
    return
  deleting.value = null
  setPosts(posts.value.filter(p => p.id !== post.id))
  await nextTick()
  emit('save', 'Post deleted')
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl" data-testid="we-blog">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-xl font-semibold tracking-tight">
          Blog
        </h3>
        <p class="mt-1 text-sm text-muted-foreground">
          Posts for your website, written in each of its {{ languages.length }} {{ languages.length === 1 ? 'language' : 'languages' }}.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" data-testid="blog-new" @click="newPost">
          <Icon name="lucide:plus" class="mr-2 size-4" aria-hidden="true" />
          New post
        </Button>
        <Button data-testid="blog-ai" @click="openAi">
          <Icon name="elev8:elevai" class="mr-2 size-4" aria-hidden="true" />
          Generate with AI
        </Button>
      </div>
    </div>

    <div v-if="sorted.length === 0" class="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card p-8 text-center" data-testid="blog-empty">
      <Icon name="lucide:newspaper" class="size-8 text-muted-foreground" aria-hidden="true" />
      <h4 class="text-base font-semibold">
        No posts yet
      </h4>
      <p class="max-w-sm text-sm text-muted-foreground">
        Let ElevAI write a first post in every language of your site, or start from a blank post.
      </p>
    </div>

    <ul v-else class="divide-y overflow-hidden rounded-xl border bg-card">
      <li v-for="post in sorted" :key="post.id" class="flex items-start gap-4 px-5 py-4" data-testid="blog-post">
        <div class="hidden h-20 w-32 shrink-0 overflow-hidden rounded-lg border bg-muted sm:block" data-testid="blog-thumb">
          <img v-if="post.cover" :src="post.cover.url" :alt="`Cover of ${postTitle(post, defaultLanguage)}`" class="size-full object-cover">
          <div v-else class="flex size-full items-center justify-center">
            <Icon name="lucide:image" class="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="truncate text-left text-sm font-semibold hover:underline" @click="startEditing(post, false)">
              {{ postTitle(post, defaultLanguage) }}
            </button>
            <Badge :variant="post.status === 'published' ? 'default' : 'secondary'">
              {{ post.status === 'published' ? 'Published' : 'Draft' }}
            </Badge>
            <Badge v-if="post.aiGenerated" variant="outline" class="gap-1">
              <Icon name="elev8:elevai" class="size-3" aria-hidden="true" />
              AI
            </Badge>
          </div>
          <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {{ post.translations[defaultLanguage]?.excerpt }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              v-for="code in languages"
              :key="code"
              class="rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase"
              :class="isTranslated(post, code) ? 'border-primary/40 bg-primary/10' : 'border-dashed text-muted-foreground'"
              :title="isTranslated(post, code) ? `${label(code)} written` : `${label(code)} missing`"
              data-testid="blog-lang"
            >
              {{ code }}
            </span>
            <span class="text-xs text-muted-foreground">· Updated {{ dateFmt(post.updatedAt) }}</span>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <Button
            :variant="post.status === 'published' ? 'outline' : 'default'"
            size="sm"
            class="mr-1"
            :disabled="post.status !== 'published' && !canPublish(post, defaultLanguage)"
            :title="post.status !== 'published' && !canPublish(post, defaultLanguage) ? `Write ${label(defaultLanguage)} first` : undefined"
            data-testid="blog-publish"
            @click="togglePublish(post)"
          >
            <Icon :name="post.status === 'published' ? 'lucide:cloud-off' : 'lucide:rocket'" class="mr-1.5 size-4" aria-hidden="true" />
            {{ post.status === 'published' ? 'Unpublish' : 'Publish' }}
          </Button>
          <Button variant="ghost" size="icon-sm" :aria-label="`Edit ${postTitle(post, defaultLanguage)}`" @click="startEditing(post, false)">
            <Icon name="lucide:pencil" class="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" :aria-label="`Delete ${postTitle(post, defaultLanguage)}`" @click="deleting = post">
            <Icon name="lucide:trash-2" class="size-4" aria-hidden="true" />
          </Button>
        </div>
      </li>
    </ul>

    <!-- Generate with AI -->
    <Dialog v-model:open="aiOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate a post with ElevAI</DialogTitle>
          <DialogDescription>
            Describe what the post is about. ElevAI writes a draft in {{ languages.map(label).join(', ') }} and a cover picture, which you can edit before publishing.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-2">
            <Label for="blog-topic">Topic</Label>
            <Input id="blog-topic" v-model="topic" placeholder="e.g. Best time to visit Bali" :disabled="generating" @keydown.enter.prevent="runGenerate" />
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="s in SUGGESTIONS"
              :key="s"
              type="button"
              class="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted"
              :disabled="generating"
              @click="topic = s"
            >
              {{ s }}
            </button>
          </div>
          <p class="text-xs text-muted-foreground">
            Demo engine: the draft is written from a template and nothing is sent anywhere.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" :disabled="generating" @click="aiOpen = false">
            Cancel
          </Button>
          <Button :disabled="!topic.trim() || generating" data-testid="blog-generate" @click="runGenerate">
            <Spinner v-if="generating" class="mr-2 size-4" />
            <Icon v-else name="elev8:elevai" class="mr-2 size-4" aria-hidden="true" />
            {{ generating ? 'Writing...' : 'Generate' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Post editor, one tab per language -->
    <Dialog :open="!!editing" @update:open="(o: boolean) => { if (!o) editing = null }">
      <DialogContent v-if="editing" class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{{ isNew ? 'New post' : 'Edit post' }}</DialogTitle>
          <DialogDescription>
            Write the post in each language. The default language ({{ label(defaultLanguage) }}) is required to publish.
          </DialogDescription>
        </DialogHeader>

        <!-- Cover picture -->
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center" data-testid="blog-cover">
          <div class="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border bg-muted sm:w-56">
            <img v-if="editing.cover" :src="editing.cover.url" alt="Post cover" class="size-full object-cover">
            <div v-else class="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <Icon name="lucide:image-plus" class="size-6" aria-hidden="true" />
              <span class="text-xs">No cover yet</span>
            </div>
            <div v-if="coverBusy" class="absolute inset-0 flex items-center justify-center bg-background/70">
              <Spinner class="size-6" />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <div class="text-sm font-medium">
              Cover picture
            </div>
            <p class="text-xs text-muted-foreground">
              {{ editing.cover ? (editing.cover.source === 'ai' ? 'Made by ElevAI.' : editing.cover.name) : 'Shown on the blog list and at the top of the post.' }}
            </p>
            <div class="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" :disabled="coverBusy" data-testid="blog-cover-ai" @click="aiCover">
                <Icon name="elev8:elevai" class="mr-1.5 size-4" aria-hidden="true" />
                {{ editing.cover?.source === 'ai' ? 'Generate again' : 'Generate with AI' }}
              </Button>
              <label class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted">
                <Icon name="lucide:upload" class="size-4" aria-hidden="true" />
                {{ editing.cover?.source === 'upload' ? 'Replace' : 'Upload' }}
                <input type="file" accept="image/*" class="sr-only" aria-label="Upload cover picture" data-testid="blog-cover-upload" @change="pickCover">
              </label>
              <Button v-if="editing.cover" variant="ghost" size="sm" data-testid="blog-cover-remove" @click="removeCover">
                Remove
              </Button>
            </div>
          </div>
        </div>

        <Tabs v-model="activeLang" data-testid="blog-editor">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger v-for="code in languages" :key="code" :value="code" :data-testid="`blog-tab-${code}`">
                {{ code.toUpperCase() }}
                <Icon v-if="!isTranslated(editing, code)" name="lucide:circle-dashed" class="ml-1 size-3 text-muted-foreground" aria-label="Missing" />
              </TabsTrigger>
            </TabsList>
            <div class="flex items-center gap-2">
              <Button v-if="missing.length > 1" variant="outline" size="sm" data-testid="blog-translate-missing" @click="translateMissing">
                <Icon name="elev8:elevai" class="mr-1.5 size-4" aria-hidden="true" />
                Write all missing ({{ missing.length }})
              </Button>
            </div>
          </div>

          <TabsContent v-for="code in languages" :key="code" :value="code" class="mt-4 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ label(code) }}<span v-if="code === defaultLanguage" class="ml-1.5 text-xs text-muted-foreground">default</span></span>
              <Button variant="ghost" size="sm" :disabled="translating !== null" :data-testid="`blog-translate-${code}`" @click="translate(code)">
                <Spinner v-if="translating === code" class="mr-1.5 size-4" />
                <Icon v-else name="elev8:elevai" class="mr-1.5 size-4" aria-hidden="true" />
                {{ isTranslated(editing, code) ? 'Rewrite with AI' : 'Write with AI' }}
              </Button>
            </div>
            <div class="space-y-2">
              <Label :for="`blog-title-${code}`">Title</Label>
              <Input :id="`blog-title-${code}`" v-model="field(code).title" />
            </div>
            <div class="space-y-2">
              <Label :for="`blog-excerpt-${code}`">Summary</Label>
              <Textarea :id="`blog-excerpt-${code}`" v-model="field(code).excerpt" class="min-h-16" />
            </div>
            <div class="space-y-2">
              <Label :for="`blog-body-${code}`">Post</Label>
              <Textarea :id="`blog-body-${code}`" v-model="field(code).body" class="min-h-48" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter class="items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <Label for="blog-status" class="text-sm">Published</Label>
            <Switch
              id="blog-status"
              :model-value="editing.status === 'published'"
              :disabled="!publishable"
              data-testid="blog-status"
              @update:model-value="(v: boolean) => { editing!.status = v ? 'published' : 'draft' }"
            />
            <span v-if="!publishable" class="text-xs text-muted-foreground">Write {{ label(defaultLanguage) }} first</span>
          </div>
          <div class="flex gap-2">
            <Button variant="ghost" @click="editing = null">
              Cancel
            </Button>
            <Button data-testid="blog-save" @click="savePost">
              Save post
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="!!deleting" @update:open="(o: boolean) => { if (!o) deleting = null }">
      <AlertDialogContent>
        <AlertDialogTitle>Delete this post?</AlertDialogTitle>
        <AlertDialogDescription>
          "{{ deleting ? postTitle(deleting, defaultLanguage) : '' }}" is removed in every language. This cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="blog-delete-confirm" @click="deletePost">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
