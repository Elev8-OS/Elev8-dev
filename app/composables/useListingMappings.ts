import { computed } from 'vue'
import { revenueByListing } from '@/components/finance/data/revenue'

export type MappingIntegration = 'jurnal' | 'bexio' | 'lexware'

export interface ListingMapping {
  integration: MappingIntegration
  tag: string
}

const BALI_KEYWORDS = ['Tambora', 'Kalmantan', 'Pererenan', 'Sinabung', 'Merapi', 'Sanur', 'Ubud', 'Canggu', 'Bali', 'Badung', 'Kerobokan']

export const allListings = revenueByListing.map(r => ({
  name: r.listing,
  city: r.city,
  region: BALI_KEYWORDS.some(k => r.city.includes(k) || r.listing.includes(k)) ? 'Bali' : 'Switzerland' as 'Bali' | 'Switzerland',
}))

const initialMappings: Record<string, ListingMapping> = {
  // ── Jurnal — Bali listings ─────────────────────────────────────────────────
  'The R Pererenan Mezzanine Studio + Plunge Pool': { integration: 'jurnal', tag: 'Bali' },
  'Cozy 2BR - the R Villa Sinabung w/ Pool in Sanur': { integration: 'jurnal', tag: 'Bali' },
  'Cozy 2BR- the R Villa Sinabung w/ Pool in Sanur': { integration: 'jurnal', tag: 'Bali' },
  'The R Villa Merapi': { integration: 'jurnal', tag: 'Bali' },
  'TAMBORA - The R Tambora: Stylish 3BR Tropical Escape': { integration: 'jurnal', tag: 'Bali' },
  'The R Loft - Cosy Suite Kalmantan incl Breakfast': { integration: 'jurnal', tag: 'Bali' },
  'The R Loft - Cosy Suite Kalmantan incl Breakfast, Roof Top': { integration: 'jurnal', tag: 'Bali' },
  'The R Loft Bali - Cosy Room incl Breakfast, Roof Top': { integration: 'jurnal', tag: 'Bali' },
  'BRATAN - The R Bratan | 3BR- Serene Getaway in Canggu': { integration: 'jurnal', tag: 'Bali' },
  'KABA - Stylish 2BR the R Villa Kaba-Kerobokan+Pool/Bikes': { integration: 'jurnal', tag: 'Bali' },
  'The R Apartments Studio walk to the Beach': { integration: 'jurnal', tag: 'Bali' },
  'Tranquil the R Villa Patuha-Pool/Rice Field Views': { integration: 'jurnal', tag: 'Bali' },
  'Cozy Meets Luxe – 3BR the R Villa Ranakah Stay': { integration: 'jurnal', tag: 'Bali' },
  'Tropical 2BR the R Villa Dempo w/Pool - Pererenan': { integration: 'jurnal', tag: 'Bali' },
  '2BR-Tropical Escape at Villa Toba | Pool & Bikes': { integration: 'jurnal', tag: 'Bali' },
  '5BR Pool the R Villa Luwa – Serene near Canggu': { integration: 'jurnal', tag: 'Bali' },
  'Modern 2BR the R Villa Swantika w/Pool - Pererenan': { integration: 'jurnal', tag: 'Bali' },
  'The R Pererenan Mezzanine Apartment w/ balcony': { integration: 'jurnal', tag: 'Bali' },
  'The R Villa Samalas | 4BR Retreat in Pererenan': { integration: 'jurnal', tag: 'Bali' },
  // ── Jurnal — Switzerland listings ───────────────────────────────────────────
  'Modern Apartment in Schaffhausen Center': { integration: 'jurnal', tag: 'Schaffhausen' },
  'The R Apartment Zugerberg - EV Wallbox - Terrasse': { integration: 'jurnal', tag: 'Geroldswil' },
  'The R Apartment Hagen': { integration: 'jurnal', tag: 'Schaffhausen' },
  'The R Apartment Uetliberg, Klima, Parken - Wallbox': { integration: 'jurnal', tag: 'Geroldswil' },
  'The R Apartment Mittelfelsen - Quiet, Free Parking': { integration: 'jurnal', tag: 'Neuhausen' },
  'The R Apartment Vogelberg, Gym, Balkon, Parking': { integration: 'jurnal', tag: 'Solothurn' },
  'The R Apartment Laufen - relaxing, free parking': { integration: 'jurnal', tag: 'Neuhausen' },
  'Stockhorn Loft - central, free parking': { integration: 'jurnal', tag: 'Bern' },
  'The R Apartment Farnsberg': { integration: 'jurnal', tag: 'Basel' },
  'The R Apartment Rheinfall - central, free parking': { integration: 'jurnal', tag: 'Schaffhausen' },
  'The R Apartment Randen': { integration: 'jurnal', tag: 'Schaffhausen' },
  'The R Apartment Bodensee - Old Town': { integration: 'jurnal', tag: 'Schaffhausen' },
  // ── Bexio — Switzerland listings ───────────────────────────────────────────
  'The R Loft - Cosy Suite incl Breakfast, Roof Top': { integration: 'bexio', tag: 'Olten' },
  'The R Loft - Cosy Suite incl Breakfast, Roof Top, Communal Kitchen and Bathroom': { integration: 'bexio', tag: 'Olten' },
  'The R Apartment Rosengasse': { integration: 'bexio', tag: 'Schaffhausen' },
  'Luxurious Renovated Apartment in Basel': { integration: 'bexio', tag: 'Basel' },
  'The R Apartment Margaretha - free public transport': { integration: 'bexio', tag: 'Basel' },
  'The R Apartment Hurbig - old Town': { integration: 'bexio', tag: 'Schaffhausen' },
  'The R Apartment Roggen': { integration: 'bexio', tag: 'Kestenholz' },
  'The R Apartment Chrischona - free public transport': { integration: 'bexio', tag: 'Basel' },
  'The R Apartment Adlisberg': { integration: 'bexio', tag: 'Zürich' },
  'The R Suites Hasenberg': { integration: 'bexio', tag: 'Aargau' },
  'The R Apartment Munot - Old Town': { integration: 'bexio', tag: 'Schaffhausen' },
  'The R Apartment Hemmental': { integration: 'bexio', tag: 'Schaffhausen' },
  'The R Apartment Froburg, Parking, ÖV, Golfplatz': { integration: 'bexio', tag: 'Obergösgen' },
  'The R Apartment Weinsteig': { integration: 'bexio', tag: 'Schaffhausen' },
  'The R Loft (Suites)': { integration: 'bexio', tag: 'Olten' },
  'The R Apartment Engelberg, Gym, Balkon, Parking': { integration: 'bexio', tag: 'Solothurn' },
  'The R Hasenberg Suite': { integration: 'bexio', tag: 'Widen' },
  'The R Apartment Passwang, Gym, Balkon, Parking': { integration: 'bexio', tag: 'Solothurn' },
}

export function useListingMappings() {
  const mappings = useState<Record<string, ListingMapping>>('listing-integration-mappings', () => ({ ...initialMappings }))

  const mappedCount = computed(() =>
    allListings.filter(l => !!mappings.value[l.name]).length,
  )

  const mappedByIntegration = computed(() => {
    const counts: Record<MappingIntegration, number> = { jurnal: 0, bexio: 0, lexware: 0 }
    Object.values(mappings.value).forEach(m => counts[m.integration]++)
    return counts
  })

  const hasAnyMapping = computed(() => mappedCount.value > 0)

  function setMapping(listingName: string, integration: MappingIntegration, tag: string) {
    mappings.value = { ...mappings.value, [listingName]: { integration, tag } }
  }

  function clearMapping(listingName: string) {
    const updated = { ...mappings.value }
    delete updated[listingName]
    mappings.value = updated
  }

  function applyToAll(integration: MappingIntegration, tag: string, region?: 'Bali' | 'Switzerland') {
    const updated = { ...mappings.value }
    allListings
      .filter(l => !region || l.region === region)
      .forEach((l) => { updated[l.name] = { integration, tag } })
    mappings.value = updated
  }

  function getMappingFor(listingName: string): ListingMapping | null {
    return mappings.value[listingName] ?? null
  }

  return {
    mappings,
    mappedCount,
    mappedByIntegration,
    hasAnyMapping,
    totalListings: allListings.length,
    setMapping,
    clearMapping,
    applyToAll,
    getMappingFor,
  }
}
