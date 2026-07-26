<!-- app/components/users/PermissionMatrix.vue -->
<script setup lang="ts">
import type { ModulePermissions, PermissionModule } from '~/components/users/data/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { DASHBOARD_PERMISSION_MODULES, MOBILE_PERMISSION_MODULES } from '~/components/users/data/permissions'

interface Props {
  permissions: Record<PermissionModule, ModulePermissions>
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), { readonly: false })

const emit = defineEmits<{
  'update:permissions': [value: Record<PermissionModule, ModulePermissions>]
}>()

function toggle(module: PermissionModule, key: keyof ModulePermissions) {
  if (props.readonly)
    return
  const next = { ...props.permissions }
  next[module] = { ...next[module], [key]: !next[module][key] }
  emit('update:permissions', next)
}

function isChecked(module: PermissionModule, key: keyof ModulePermissions): boolean {
  return props.permissions[module]?.[key] ?? false
}
</script>

<template>
  <Card>
    <CardHeader class="pb-3">
      <CardTitle class="text-base">
        Permissions
      </CardTitle>
      <p class="text-xs text-muted-foreground">
        Configure which modules this role can view or edit on each platform.
      </p>
    </CardHeader>
    <CardContent class="p-0">
      <Tabs default-value="dashboard" class="w-full">
        <TabsList class="w-full rounded-none border-b bg-transparent p-0 h-auto">
          <TabsTrigger
            value="dashboard"
            class="flex-1 rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Icon name="lucide:monitor" class="mr-2 size-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger
            value="mobile"
            class="flex-1 rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Icon name="lucide:smartphone" class="mr-2 size-4" />
            Mobile
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            class="flex-1 rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Icon name="lucide:bell" class="mr-2 size-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" class="m-0">
          <div class="border-y">
            <!-- Header row -->
            <div class="grid grid-cols-[1fr_80px_80px] text-xs font-medium text-muted-foreground px-4 py-2 border-b bg-muted/30">
              <div>Module</div>
              <div class="text-center">
                View
              </div>
              <div class="text-center">
                Edit
              </div>
            </div>

            <!-- Module rows -->
            <div
              v-for="m in DASHBOARD_PERMISSION_MODULES"
              :key="m.id"
              class="grid grid-cols-[1fr_80px_80px] items-center px-4 py-2 border-b last:border-b-0 hover:bg-muted/20"
            >
              <div class="text-sm">
                {{ m.label }}
              </div>

              <!-- Dashboard View -->
              <div class="flex justify-center">
                <button
                  type="button"
                  :aria-label="`${m.label} dashboard view`"
                  :aria-pressed="isChecked(m.id, 'dashboardView')"
                  :disabled="readonly"
                  class="flex size-5 items-center justify-center rounded border transition-colors"
                  :class="isChecked(m.id, 'dashboardView')
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'"
                  @click="toggle(m.id, 'dashboardView')"
                >
                  <Icon v-if="isChecked(m.id, 'dashboardView')" name="lucide:check" class="size-3" />
                </button>
              </div>

              <!-- Dashboard Edit -->
              <div class="flex justify-center">
                <button
                  type="button"
                  :aria-label="`${m.label} dashboard edit`"
                  :aria-pressed="isChecked(m.id, 'dashboardEdit')"
                  :disabled="readonly"
                  class="flex size-5 items-center justify-center rounded border transition-colors"
                  :class="isChecked(m.id, 'dashboardEdit')
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'"
                  @click="toggle(m.id, 'dashboardEdit')"
                >
                  <Icon v-if="isChecked(m.id, 'dashboardEdit')" name="lucide:check" class="size-3" />
                </button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mobile" class="m-0">
          <div class="border-y">
            <!-- Header row -->
            <div class="grid grid-cols-[1fr_80px_80px] text-xs font-medium text-muted-foreground px-4 py-2 border-b bg-muted/30">
              <div>Module</div>
              <div class="text-center">
                View
              </div>
              <div class="text-center">
                Edit
              </div>
            </div>

            <!-- Module rows -->
            <div
              v-for="m in MOBILE_PERMISSION_MODULES"
              :key="m.id"
              class="grid grid-cols-[1fr_80px_80px] items-center px-4 py-2 border-b last:border-b-0 hover:bg-muted/20"
            >
              <div class="text-sm">
                {{ m.label }}
              </div>

              <!-- Mobile View -->
              <div class="flex justify-center">
                <button
                  type="button"
                  :aria-label="`${m.label} mobile view`"
                  :aria-pressed="isChecked(m.id, 'mobileView')"
                  :disabled="readonly"
                  class="flex size-5 items-center justify-center rounded border transition-colors"
                  :class="isChecked(m.id, 'mobileView')
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'"
                  @click="toggle(m.id, 'mobileView')"
                >
                  <Icon v-if="isChecked(m.id, 'mobileView')" name="lucide:check" class="size-3" />
                </button>
              </div>

              <!-- Mobile Edit -->
              <div class="flex justify-center">
                <button
                  type="button"
                  :aria-label="`${m.label} mobile edit`"
                  :aria-pressed="isChecked(m.id, 'mobileEdit')"
                  :disabled="readonly"
                  class="flex size-5 items-center justify-center rounded border transition-colors"
                  :class="isChecked(m.id, 'mobileEdit')
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'"
                  @click="toggle(m.id, 'mobileEdit')"
                >
                  <Icon v-if="isChecked(m.id, 'mobileEdit')" name="lucide:check" class="size-3" />
                </button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" class="m-0 p-6">
          <div class="space-y-2">
            <slot name="notifications" />
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
