<script setup lang="ts">
import PortalStatementDetail from '~/components/owner-portal/PortalStatementDetail.vue'

definePageMeta({
  layout: 'owner-portal',
})

const route = useRoute()
const statementId = computed(() => String(route.params.id ?? ''))
</script>

<template>
  <PortalStatementDetail :statement-id="statementId" />
</template>
