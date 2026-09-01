import type { PropType } from 'vue'
import { defineComponent, h } from 'vue'
import ChartTooltip from '~/components/ui/chart/ChartTooltip.vue'

interface TooltipItem { name: string, color: string, value: unknown }

// Shared label and value formatting for the owner dashboard charts.
//
// The chart components use the data object's KEYS as legend and tooltip
// labels, so the keys have to read as English — an owner hovering a chart
// should see "Your net payout", not "net".

/** `2026-09` -> `Sep 2026`. Used for both the x-axis and the tooltip. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month)
    return period
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
  return `${label} ${year}`
}

const CHANNEL_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  direct: 'Direct booking',
  agoda: 'Agoda',
  vrbo: 'Vrbo',
  expedia: 'Expedia',
}

/** `booking_com` -> `Booking.com`; unknown keys are title-cased. */
export function formatChannel(key: string): string {
  return CHANNEL_LABELS[key]
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * The stock chart tooltip prints the raw number, so hovering a revenue chart
 * shows `4285000` rather than `IDR 4,285,000`. The chart components accept a
 * `customTooltip` component but instantiate it with only `title` and `data`,
 * so the formatter is baked in here and the wrapper reuses the standard
 * tooltip for its markup.
 */
export function makeChartTooltip(format: (value: number) => string) {
  return defineComponent({
    name: 'PortalChartTooltip',
    props: {
      title: { type: String, default: '' },
      data: { type: Array as PropType<TooltipItem[]>, required: true },
    },
    setup(props) {
      return () => h(ChartTooltip, {
        title: props.title,
        data: props.data.map(item => ({
          ...item,
          // A null point (e.g. no prior-year figure) should read as absent,
          // not as zero.
          value: typeof item.value === 'number' ? format(item.value) : '—',
        })),
      })
    },
  })
}
