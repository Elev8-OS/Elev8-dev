export interface InvoiceTemplateCompanyDetails {
  companyName: string
  commercialRegisterNo?: string
  managingDirector?: string
  address: string
  postalCode?: string
  city?: string
  registeredCity?: string
  email?: string
  phone?: string
  website?: string
  vatNumber?: string
  logoDataUrl?: string
}

export interface InvoiceTemplateBankDetails {
  bankName: string
  accountHolder: string
  iban?: string
  accountNumber?: string
  bicSwift?: string
}

export interface InvoiceTemplate {
  id: string
  name: string
  isDefault: boolean
  headerMessage?: string
  footerMessage?: string
  company: InvoiceTemplateCompanyDetails
  bank: InvoiceTemplateBankDetails
  assignedListingIds: string[]
  createdAt: string
  updatedAt: string
}

export const INVOICE_TEMPLATES_STORAGE_KEY = 'elev8-invoice-templates-v1'

export const DEFAULT_HEADER_MESSAGE
  = 'Thank you for choosing Us. Below you\'ll find the summary of your booking and payment details. Please review carefully and contact us if any information is incorrect.'

export const DEFAULT_FOOTER_MESSAGE
  = 'Please make payment within 7 days using booking ID as your reference. For any billing inquiries, contact us. Thank you for your stay!'

export const SEED_INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'tmpl-schweiz',
    name: 'Elevate Schweiz GmbH (Europe)',
    isDefault: true,
    headerMessage: DEFAULT_HEADER_MESSAGE,
    footerMessage: DEFAULT_FOOTER_MESSAGE,
    company: {
      companyName: 'Elevate Schweiz GmbH',
      commercialRegisterNo: 'CHE-163.290.666',
      managingDirector: 'Marc Schneider',
      address: 'Im Fueler 7',
      postalCode: '4616',
      city: 'Kappel',
      registeredCity: 'Kappel, Switzerland',
      email: 'hello@elevater.ch',
      phone: '+41 62 209 1100',
      website: 'https://elevater.ch',
      vatNumber: 'CHE-163.290.666MWST',
    },
    bank: {
      bankName: 'Aargauische Kantonalbank',
      accountHolder: 'Elevate Schweiz GmbH',
      iban: 'CH69 0076 1648 8692 1200 2',
      bicSwift: 'KBAGCH22',
    },
    assignedListingIds: [
      'listing-1', // Villa Luwa
      'listing-2', // Villa Serenity
      'listing-3', // Mandala House
      'listing-4', // The Palm House
      'listing-5', // Villa Uma
      'listing-6', // Casa Blanca
      'listing-7', // Villa Bella
      'listing-8', // Bamboo Sanctuary
      'listing-9', // Cliffside Villa
      'listing-10', // Eco Bamboo Loft
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
  },
  {
    id: 'tmpl-bali-local',
    name: 'PT Elev8 Bali Mandiri (Indonesia)',
    isDefault: false,
    headerMessage: 'Thank you for choosing Elev8 Bali. Below you\'ll find the details of your stay and payments. Please review carefully.',
    footerMessage: 'Payment is due upon settlement. For billing or tax invoice inquiries, please contact our guest relations team.',
    company: {
      companyName: 'PT Elev8 Bali Mandiri',
      commercialRegisterNo: 'AHU-0012984.AH.01.01.TAHUN 2024',
      managingDirector: 'I Wayan Juliantara',
      address: 'Jl. Pantai Berawa No. 22A',
      postalCode: '80361',
      city: 'Canggu, Bali',
      registeredCity: 'Badung, Bali',
      email: 'billing@elev8bali.com',
      phone: '+62 361 908 1234',
      website: 'https://elev8bali.com',
      vatNumber: 'NPWP: 01.234.567.8-901.000',
    },
    bank: {
      bankName: 'Bank Central Asia (BCA)',
      accountHolder: 'PT Elev8 Bali Mandiri',
      accountNumber: '7890 1234 56',
      bicSwift: 'CENAIDJA',
    },
    assignedListingIds: [
      'listing-11',
      'listing-12',
      'listing-13',
      'listing-14',
      'listing-15',
      'listing-16',
      'listing-17',
      'listing-18',
      'listing-19',
    ],
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-09-15T08:00:00.000Z',
  },
]

export function createBlankInvoiceTemplate(): Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    isDefault: false,
    headerMessage: DEFAULT_HEADER_MESSAGE,
    footerMessage: DEFAULT_FOOTER_MESSAGE,
    company: {
      companyName: '',
      commercialRegisterNo: '',
      managingDirector: '',
      address: '',
      postalCode: '',
      city: '',
      registeredCity: '',
      email: '',
      phone: '',
      website: '',
      vatNumber: '',
      logoDataUrl: '',
    },
    bank: {
      bankName: '',
      accountHolder: '',
      iban: '',
      accountNumber: '',
      bicSwift: '',
    },
    assignedListingIds: [],
  }
}
