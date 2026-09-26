> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

## 🧱 shadcn-vue Usage Patterns

### Button Variants
```vue
<!-- Primary action -->
<Button>
Save
</Button>

<!-- Destructive action -->
<Button variant="destructive">
Delete
</Button>

<!-- Secondary / Cancel -->
<Button variant="outline">
Cancel
</Button>

<!-- Ghost / Icon only -->
<Button variant="ghost" size="icon">
<Icon />
</Button>

<!-- Link style -->
<Button variant="link">
Learn more
</Button>

<!-- With loading state -->
<Button :disabled="isLoading">
  <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
  Submit
</Button>
```

### Dialog Pattern
```vue
<Dialog v-model:open="isOpen">
  <DialogTrigger as-child>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Description of what this dialog does.</DialogDescription>
    </DialogHeader>
    <!-- Body content -->
    <DialogFooter>
      <Button variant="outline" @click="isOpen = false">Cancel</Button>
      <Button @click="handleConfirm">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Form Pattern (vee-validate + zod)
```vue
<script setup>
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

const formSchema = toTypedSchema(z.object({
  username: z.string().min(2).max(50),
}))

function onSubmit(values) {
  console.log('Form submitted!', values)
}
</script>

<template>
  <Form v-slot="{ handleSubmit }" :validation-schema="formSchema">
    <form @submit="handleSubmit($event, onSubmit)">
      <FormField v-slot="{ componentField }" name="username">
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input type="text" placeholder="shadcn" v-bind="componentField" />
          </FormControl>
          <FormDescription>This is your public display name.</FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit">
        Submit
      </Button>
    </form>
  </Form>
</template>
```

### Sheet (Slide-over) Pattern
```vue
<Sheet>
  <SheetTrigger as-child>
    <Button variant="outline">Open Sheet</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>Edit profile</SheetTitle>
      <SheetDescription>Make changes to your profile here.</SheetDescription>
    </SheetHeader>
    <!-- Content -->
    <SheetFooter>
      <SheetClose as-child>
        <Button type="submit">Save changes</Button>
      </SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### DataTable (TanStack)
```vue
<script setup>
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'

const table = useVueTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
})
</script>

<template>
  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
          <TableHead v-for="header in headerGroup.headers" :key="header.id">
            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="row in table.getRowModel().rows" :key="row.id">
          <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
            <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
```
