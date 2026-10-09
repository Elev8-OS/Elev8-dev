import type { CockpitOverride, OverrideValues } from '~/components/cockpit/data/cockpit-overrides'

/**
 * The Cockpit's date overrides (`cockpit-overrides.ts`): the only writer of
 * them. Mock, in memory per session; nothing reaches a channel.
 */
export function useCockpitOverrides() {
  const overrides = useState<CockpitOverride[]>('cockpit-overrides', () => [])

  function addOverride(input: { listingId: string, unitTypeId: string | null, from: string, to: string, values: Partial<OverrideValues> }): CockpitOverride {
    const override: CockpitOverride = {
      id: `ovr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...input,
      values: { ...input.values },
      createdAt: new Date().toISOString(),
    }
    overrides.value = [...overrides.value, override]
    return override
  }

  function removeOverride(id: string) {
    overrides.value = overrides.value.filter(o => o.id !== id)
  }

  return { overrides, addOverride, removeOverride }
}
