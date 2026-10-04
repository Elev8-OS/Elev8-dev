<script setup lang="ts">
/** Leaving Listing Setup with unsaved changes: save, discard, or stay. */
defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean], 'save': [], 'discard': [] }>()
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
        <AlertDialogDescription>
          You have unsaved changes to this listing's setup. Save them before you go, or discard them.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="gap-2 sm:justify-between">
        <AlertDialogCancel data-testid="leave-keep-editing">
          Keep editing
        </AlertDialogCancel>
        <div class="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" class="text-destructive hover:text-destructive" data-testid="leave-discard" @click="emit('discard')">
            Discard and leave
          </Button>
          <Button data-testid="leave-save" @click="emit('save')">
            Save and leave
          </Button>
        </div>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
