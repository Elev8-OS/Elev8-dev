import type { WaiverInvoiceBillTo } from '~/components/damage-protection/data/waiver-billing'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'
import { useOnboarding } from '~/composables/useOnboarding'
import { useTernActivation } from '~/composables/useTernActivation'

/**
 * Who Elev8's invoices are addressed to: the onboarding profile when it is
 * filled in, else the company on the tenant's default invoice template (its
 * own billing entity). Every invoice freezes what this returns when it is
 * issued.
 */
export function useTenantBillTo() {
  const onboarding = useOnboarding()
  const tern = useTernActivation()
  const { getDefaultTemplate } = useInvoiceTemplates()

  function billTo(): WaiverInvoiceBillTo {
    const profile = onboarding.state.value.profile
    const ternOrganizationId = tern.activation.value.ternOrganizationId
    if (profile?.companyName?.trim()) {
      return {
        companyName: profile.companyName.trim(),
        addressLines: [profile.addressLine, [profile.zipCode, profile.city].filter(Boolean).join(' '), profile.country]
          .filter((line): line is string => Boolean(line?.trim())),
        ternOrganizationId,
      }
    }
    const company = getDefaultTemplate().company
    return {
      companyName: company.companyName,
      addressLines: [company.address, [company.postalCode, company.city].filter(Boolean).join(' ')]
        .filter((line): line is string => Boolean(line?.trim())),
      vatNumber: company.vatNumber,
      ternOrganizationId,
    }
  }

  return { billTo }
}
