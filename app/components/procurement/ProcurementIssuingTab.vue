<script setup lang="ts">
import type { Issuing, IssueStatus } from '@/components/procurement/data/issuings'
import { toast } from 'vue-sonner'
import { ISSUE_STATUS_LABELS } from '@/components/procurement/data/issuings'
import { staffMembers } from '@/components/inbox/data/conversations'
import { useIssuings } from '@/composables/useIssuings'

const {
  filteredIssuings,
  searchValue,
  activeStatusFilter,
  completeIssuing,
} = useIssuings()

const drawerOpen = ref(false)
const selectedIssuing = ref<Issuing | null>(null)

function openView(iss: Issuing) {
  selectedIssuing.value = iss
  drawerOpen.value = true
}

function handleComplete(iss: Issuing) {
  completeIssuing(iss.id)
  toast.success(`${iss.issueNumber} completed`)
}

function getStaffName(staffId: string): string {
  return staffMembers.find(s => s.id === staffId)?.name ?? staffId
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getStatusVariant(status: IssueStatus) {
  return status === 'draft' ? 'outline' : 'default'
}

function getStatusClass(status: IssueStatus) {
  return status === 'draft'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-green-100 text-green-700 border-green-200'
}

const STATUS_OPTIONS: { value: IssueStatus | 'all', label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-48">
        <Icon name="lucide:search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchValue" placeholder="Search..." class="pl-8" />
      </div>

      <Select v-model="activeStatusFilter">
        <SelectTrigger class="w-40 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue #</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Issued By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead class="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="iss in filteredIssuings"
            :key="iss.id"
            class="cursor-pointer"
            @click="openView(iss)"
          >
            <TableCell class="font-mono text-sm">
              {{ iss.issueNumber }}
            </TableCell>
            <TableCell>
              {{ iss.items.length }} item{{ iss.items.length !== 1 ? 's' : '' }}
            </TableCell>
            <TableCell>
              {{ getStaffName(iss.issuedBy) }}
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusVariant(iss.status)" :class="getStatusClass(iss.status)">
                {{ ISSUE_STATUS_LABELS[iss.status] }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(iss.issuedAt) }}
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openView(iss)">
                    <Icon name="lucide:eye" class="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="iss.status === 'draft'" @click="handleComplete(iss)">
                    <Icon name="lucide:check" class="mr-2 h-4 w-4" />
                    Complete Issue
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredIssuings.length === 0">
            <TableCell colspan="6" class="text-center text-muted-foreground py-10">
              No issuings found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ProcurementIssuingDrawer v-model:open="drawerOpen" :issuing="selectedIssuing" />
  </div>
</template>
