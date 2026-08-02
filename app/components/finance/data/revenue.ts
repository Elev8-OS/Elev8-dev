export type ReservationStatus = 'Unverified' | 'Verified' | 'Checked-in' | 'Checked-out'

export interface ReservationEntry {
  id: string
  guest: string
  listing: string
  channel: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  amount: number
  currency: string
  status: ReservationStatus
  invoice: string
  synced: boolean
  syncedAt?: string
}

export const revenueStats = {
  totalRevenue: 105524.04,
  totalReservations: 118,
  totalNights: 781,
  adr: 145.12,
  adrLast30Days: 158.22,
  avgLengthOfStay: 6.9,
  avgGuestsPerBooking: 2.5,
  occupancyPct: 36.2,
  totalListings: 86,
  currency: 'CHF',
}

export const revenueByChannel = [
  {
    channel: 'Booking.com',
    key: 'BOOKING_COM',
    revenue: 38783.25,
    reservations: 57,
    pctRevenue: 48.2,
    pctBookings: 55.9,
    adr: 147.68,
    avgNights: 5.4,
    currency: 'CHF',
  },
  {
    channel: 'Airbnb',
    key: 'AIRBNB',
    revenue: 29521.36,
    reservations: 29,
    pctRevenue: 36.7,
    pctBookings: 28.4,
    adr: 181.82,
    avgNights: 6.6,
    currency: 'CHF',
  },
  {
    channel: 'Direct',
    key: 'DIRECT',
    revenue: 12219.43,
    reservations: 16,
    pctRevenue: 15.2,
    pctBookings: 15.7,
    adr: 69.47,
    avgNights: 13.2,
    currency: 'CHF',
  },
]

export const revenueByListing = [
  { listing: 'Modern Apartment in Schaffhausen Center', city: 'Schaffhausen', revenue: 9104.31, reservations: 2, nights: 68, adr: 176.14 },
  { listing: 'The R Apartment Zugerberg - EV Wallbox - Terrasse', city: 'Geroldswil', revenue: 4821.49, reservations: 5, nights: 21, adr: 230.67 },
  { listing: 'The R Apartment Hagen', city: 'Schaffhausen', revenue: 4525.98, reservations: 3, nights: 18, adr: 284.34 },
  { listing: 'The R Apartment Uetliberg, Klima, Parken - Wallbox', city: 'Geroldswil', revenue: 4021.52, reservations: 6, nights: 19, adr: 223.12 },
  { listing: 'The R Apartment Mittelfelsen - Quiet, Free Parking', city: 'Neuhausen am Rheinfall', revenue: 3500.00, reservations: 1, nights: 31, adr: 112.9 },
  { listing: 'The R Apartment Vogelberg, Gym, Balkon, Parking', city: 'Solothurn', revenue: 3459.96, reservations: 1, nights: 31, adr: 111.61 },
  { listing: 'The R Apartment Laufen - relaxing, free parking', city: 'Neuhausen am Rheinfall', revenue: 2931.46, reservations: 3, nights: 18, adr: 187.23 },
  { listing: 'Stockhorn Loft - central, free parking', city: 'Bern', revenue: 2680.81, reservations: 4, nights: 15, adr: 180.21 },
  { listing: 'The R Apartment Farnsberg', city: 'Basel', revenue: 2652.30, reservations: 3, nights: 17, adr: 158.25 },
  { listing: 'The R Pererenan Mezzanine Studio + Plunge Pool', city: 'Badung', revenue: 2615.08, reservations: 1, nights: 26, adr: 100.58 },
  { listing: 'The R Apartment Rheinfall - central, free parking', city: 'Schaffhausen', revenue: 2422.00, reservations: 3, nights: 11, adr: 217.78 },
  { listing: 'The R Apartment Randen', city: 'Schaffhausen', revenue: 2362.85, reservations: 3, nights: 14, adr: 191.07 },
  { listing: 'The R Apartment Bodensee - Old Town', city: 'Schaffhausen', revenue: 2246.80, reservations: 2, nights: 11, adr: 201.63 },
  { listing: 'The R Apartment Rosengasse', city: 'Schaffhausen', revenue: 2230.76, reservations: 3, nights: 12, adr: 204.24 },
  { listing: 'Luxurious Renovated Apartment in Basel', city: 'Basel', revenue: 2104.96, reservations: 3, nights: 15, adr: 146.63 },
  { listing: 'The R Apartment Margaretha - free public transport', city: 'Basel', revenue: 2020.05, reservations: 4, nights: 12, adr: 166.78 },
  { listing: 'The R Apartment Hurbig - old Town', city: 'Schaffhausen', revenue: 1861.80, reservations: 3, nights: 7, adr: 260.35 },
  { listing: 'The R Apartment Roggen', city: 'Kestenholz', revenue: 1797.20, reservations: 1, nights: 18, adr: 99.84 },
  { listing: 'Cozy 2BR - the R Villa Sinabung w/ Pool in Sanur', city: 'Bali', revenue: 1720.11, reservations: 3, nights: 24, adr: 65.59 },
  { listing: 'The R Apartment Chrischona - free public transport', city: 'Basel', revenue: 1644.51, reservations: 2, nights: 14, adr: 151.44 },
  { listing: 'The R Apartment Adlisberg', city: 'Zürich', revenue: 1634.18, reservations: 2, nights: 8, adr: 214.52 },
  { listing: 'The R Suites Hasenberg', city: 'Aargau', revenue: 1542.22, reservations: 4, nights: 13, adr: 120.21 },
  { listing: 'The R Apartment Munot - Old Town', city: 'Schaffhausen', revenue: 1496.33, reservations: 2, nights: 9, adr: 163.45 },
  { listing: 'The R Apartment Hemmental', city: 'Schaffhausen', revenue: 1379.29, reservations: 2, nights: 9, adr: 179.38 },
  { listing: 'The R Apartment Froburg, Parking, ÖV, Golfplatz', city: 'Obergösgen', revenue: 1329.25, reservations: 1, nights: 12, adr: 110.77 },
  { listing: 'The R Apartment Weinsteig', city: 'Schaffhausen', revenue: 1325.06, reservations: 3, nights: 11, adr: 121.13 },
  { listing: 'The R Villa Merapi', city: 'Badung', revenue: 1265.34, reservations: 2, nights: 49, adr: 24.09 },
  { listing: 'The R Loft (Suites)', city: 'Olten', revenue: 1124.71, reservations: 6, nights: 17, adr: 68.04 },
  { listing: 'The R Apartment Engelberg, Gym, Balkon, Parking', city: 'Solothurn', revenue: 881.55, reservations: 2, nights: 5, adr: 175.04 },
  { listing: 'The R Hasenberg Suite', city: 'Widen', revenue: 702.97, reservations: 2, nights: 6, adr: 117.16 },
  { listing: 'The R Apartment Passwang, Gym, Balkon, Parking', city: 'Solothurn', revenue: 612.30, reservations: 1, nights: 5, adr: 122.46 },
  // ── EUR-denominated DACH listings (Lexware-eligible) ─────────────────────
  { listing: 'Villa Luwa – Hügellage Brandenburg', city: 'Potsdam', revenue: 5030.00, reservations: 4, nights: 20, adr: 251.50 },
  { listing: 'Villa Sehnsucht – Seegrundstück Mecklenburg', city: 'Waren (Müritz)', revenue: 6340.00, reservations: 3, nights: 19, adr: 333.68 },
  { listing: 'Villa Bergfried – Schwarzwald', city: 'Freiburg', revenue: 3720.00, reservations: 3, nights: 12, adr: 310.00 },
  { listing: 'Villa Zeitreise – Weinregion Pfalz', city: 'Neustadt', revenue: 4990.00, reservations: 3, nights: 13, adr: 383.85 },
  { listing: 'Villa Kunstpause – Kulturhaupstadt Weimar', city: 'Weimar', revenue: 3420.00, reservations: 3, nights: 10, adr: 342.00 },
]

export const recentReservations: ReservationEntry[] = [
  // ── EUR DACH check-ins (July 2026 — Lexware-eligible) ─────────────────────
  { id: 'lex-res-001', guest: 'Erik Hoffmann', listing: 'Villa Luwa – Hügellage Brandenburg', channel: 'Airbnb', checkIn: '2026-07-21', checkOut: '2026-07-26', nights: 5, guests: 2, amount: 1280.00, currency: 'EUR', status: 'Checked-out', invoice: 'LS-2026-0042', synced: true, syncedAt: '2026-07-27T10:00:00Z' },
  { id: 'lex-res-002', guest: 'Anna Brunner', listing: 'Villa Sehnsucht – Seegrundstück Mecklenburg', channel: 'Airbnb', checkIn: '2026-07-22', checkOut: '2026-07-29', nights: 7, guests: 2, amount: 2460.00, currency: 'EUR', status: 'Checked-out', invoice: 'LS-2026-0043', synced: false },
  { id: 'lex-res-003', guest: 'Lukas Vogel', listing: 'Villa Bergfried – Schwarzwald', channel: 'Airbnb', checkIn: '2026-07-18', checkOut: '2026-07-21', nights: 3, guests: 2, amount: 980.00, currency: 'EUR', status: 'Checked-out', invoice: 'LS-2026-0040', synced: true, syncedAt: '2026-07-25T14:00:00Z' },
  { id: 'lex-res-004', guest: 'Markus Steiner', listing: 'Villa Zeitreise – Weinregion Pfalz', channel: 'Airbnb', checkIn: '2026-07-12', checkOut: '2026-07-16', nights: 4, guests: 2, amount: 1640.00, currency: 'EUR', status: 'Checked-out', invoice: 'LS-2026-0038', synced: true, syncedAt: '2026-07-29T13:30:00Z' },
  { id: 'lex-res-005', guest: 'Sophia Maier', listing: 'Villa Kunstpause – Kulturhaupstadt Weimar', channel: 'Airbnb', checkIn: '2026-07-28', checkOut: '2026-07-30', nights: 2, guests: 2, amount: 720.00, currency: 'EUR', status: 'Checked-out', invoice: 'pending', synced: false },
  { id: 'lex-res-006', guest: 'Christina Wolf', listing: 'Villa Luwa – Hügellage Brandenburg', channel: 'Booking.com', checkIn: '2026-07-28', checkOut: '2026-08-02', nights: 5, guests: 2, amount: 1450.00, currency: 'EUR', status: 'Checked-out', invoice: 'pending', synced: false },
  { id: 'lex-res-007', guest: 'Julia Wagner', listing: 'Villa Zeitreise – Weinregion Pfalz', channel: 'Booking.com', checkIn: '2026-07-26', checkOut: '2026-07-30', nights: 4, guests: 2, amount: 1500.00, currency: 'EUR', status: 'Checked-out', invoice: 'pending', synced: false },
  { id: 'lex-res-008', guest: 'Marta Kowalski', listing: 'Villa Luwa – Hügellage Brandenburg', channel: 'Direct', checkIn: '2026-08-08', checkOut: '2026-08-13', nights: 5, guests: 3, amount: 1200.00, currency: 'EUR', status: 'Verified', invoice: 'pending', synced: false },
  // ── May 1 check-ins ──────────────────────────────────────────────────────
  { id: '86109494', guest: 'Thomas Wikes', listing: 'TAMBORA - The R Tambora: Stylish 3BR Tropical Escape', channel: 'Direct', checkIn: '2026-05-01', checkOut: '2026-05-04', nights: 3, guests: 2, amount: 367.00, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86109494_wikes.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '85356478', guest: 'Christine Scherrer', listing: 'The R Apartment Hemmental', channel: 'Booking.com', checkIn: '2026-05-01', checkOut: '2026-05-03', nights: 2, guests: 2, amount: 341.58, currency: 'CHF', status: 'Checked-out', invoice: 'inv_85356478_scherrer.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '85850379', guest: 'Lê Thương', listing: 'The R Apartment Uetliberg, Klima, Parken - Wallbox', channel: 'Airbnb', checkIn: '2026-05-01', checkOut: '2026-05-04', nights: 3, guests: 3, amount: 632.33, currency: 'CHF', status: 'Checked-out', invoice: 'inv_85850379_thuong.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '86060051', guest: 'Kerstin Klein', listing: 'Modern Apartment in Schaffhausen Center', channel: 'Booking.com', checkIn: '2026-05-01', checkOut: '2026-05-02', nights: 1, guests: 3, amount: 241.80, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86060051_klein.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '83828094', guest: 'Mate Bezdek', listing: 'The R Apartment Mittelfelsen - Quiet, Free Parking', channel: 'Direct', checkIn: '2026-05-01', checkOut: '2026-06-01', nights: 31, guests: 2, amount: 3500.00, currency: 'CHF', status: 'Checked-in', invoice: 'inv_83828094_bezdek.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '86119381', guest: 'Alette Kramer', listing: 'The R Apartment Bodensee - Old Town', channel: 'Booking.com', checkIn: '2026-05-01', checkOut: '2026-05-02', nights: 1, guests: 5, amount: 338.33, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86119381_kramer.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '85994225', guest: 'Gerald Staberock', listing: 'The R Apartment Randen', channel: 'Booking.com', checkIn: '2026-05-01', checkOut: '2026-05-03', nights: 2, guests: 4, amount: 408.13, currency: 'CHF', status: 'Checked-out', invoice: 'inv_85994225_staberock.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '86069594', guest: 'Isabelle Brüsch', listing: 'The R Apartment Chrischona - free public transport', channel: 'Booking.com', checkIn: '2026-05-01', checkOut: '2026-05-12', nights: 11, guests: 1, amount: 1011.86, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86069594_brusch.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  { id: '83758668', guest: 'Alicia Medina de la Maza', listing: 'The R Loft - Cosy Suite incl Breakfast, Roof Top', channel: 'Booking.com', checkIn: '2026-05-01', checkOut: '2026-05-03', nights: 2, guests: 2, amount: 173.56, currency: 'CHF', status: 'Checked-out', invoice: 'inv_83758668_medina.pdf', synced: true, syncedAt: '2026-05-01T10:00:00Z' },
  // ── May 2 check-ins ──────────────────────────────────────────────────────
  { id: '86163839', guest: 'Alette Kramer', listing: 'The R Apartment Bodensee - Old Town', channel: 'Direct', checkIn: '2026-05-02', checkOut: '2026-05-03', nights: 1, guests: 5, amount: 259.50, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86163839_kramer2.pdf', synced: true, syncedAt: '2026-05-02T10:00:00Z' },
  { id: '86180138', guest: 'Mirel Hadji', listing: 'The R Suites Hasenberg', channel: 'Direct', checkIn: '2026-05-02', checkOut: '2026-05-03', nights: 1, guests: 2, amount: 107.00, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86180138_hadji.pdf', synced: true, syncedAt: '2026-05-02T10:00:00Z' },
  { id: '86111741', guest: 'Volodymyr Shypka', listing: 'The R Loft - Cosy Suite Kalmantan incl Breakfast', channel: 'Airbnb', checkIn: '2026-05-02', checkOut: '2026-05-05', nights: 3, guests: 2, amount: 194.30, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86111741_shypka.pdf', synced: true, syncedAt: '2026-05-02T10:00:00Z' },
  // ── May 3–5 check-ins (unsynced) ─────────────────────────────────────────
  { id: '85933489', guest: 'Beat Obrist', listing: 'The R Loft - Cosy Suite incl Breakfast, Roof Top', channel: 'Booking.com', checkIn: '2026-05-03', checkOut: '2026-05-08', nights: 5, guests: 2, amount: 250.00, currency: 'CHF', status: 'Checked-out', invoice: 'inv_85933489_obrist.pdf', synced: false },
  { id: '86060052', guest: 'Andrea Allegretti', listing: 'Modern Apartment in Schaffhausen Center', channel: 'Booking.com', checkIn: '2026-05-03', checkOut: '2026-05-07', nights: 4, guests: 1, amount: 491.74, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86060052_allegretti.pdf', synced: false },
  { id: '85359984', guest: 'Jeremie Lambelin', listing: 'The R Loft - Cosy Suite incl Breakfast, Roof Top', channel: 'Booking.com', checkIn: '2026-05-03', checkOut: '2026-05-08', nights: 5, guests: 1, amount: 250.00, currency: 'CHF', status: 'Checked-out', invoice: 'inv_85359984_lambelin.pdf', synced: false },
  { id: '86312047', guest: 'Sandra Meier', listing: 'The R Apartment Rosengasse', channel: 'Airbnb', checkIn: '2026-05-05', checkOut: '2026-05-08', nights: 3, guests: 2, amount: 498.50, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86312047_meier.pdf', synced: false },
  { id: '86298531', guest: 'Klaus Hartmann', listing: 'The R Apartment Hagen', channel: 'Booking.com', checkIn: '2026-05-05', checkOut: '2026-05-11', nights: 6, guests: 3, amount: 1123.40, currency: 'CHF', status: 'Checked-out', invoice: 'inv_86298531_hartmann.pdf', synced: false },
  // ── Upcoming (unsynced) ──────────────────────────────────────────────────
  { id: '86401122', guest: 'Petra Vogler', listing: 'The R Apartment Weinsteig', channel: 'Booking.com', checkIn: '2026-05-20', checkOut: '2026-05-24', nights: 4, guests: 2, amount: 528.00, currency: 'CHF', status: 'Verified', invoice: 'inv_86401122_vogler.pdf', synced: false },
  { id: '86455389', guest: 'David Andréani', listing: 'The R Apartment Hurbig - old Town', channel: 'Airbnb', checkIn: '2026-05-22', checkOut: '2026-05-26', nights: 4, guests: 2, amount: 712.50, currency: 'CHF', status: 'Unverified', invoice: 'inv_86455389_andreani.pdf', synced: false },
  { id: '86512047', guest: 'Sun Li', listing: 'Cozy 2BR - the R Villa Sinabung w/ Pool in Sanur', channel: 'Airbnb', checkIn: '2026-05-28', checkOut: '2026-06-04', nights: 7, guests: 4, amount: 895.20, currency: 'CHF', status: 'Unverified', invoice: 'inv_86512047_sunli.pdf', synced: false },
]
