import type { CleaningReportGroup } from '~/components/reservations/data/claim-cleaning'
import type { DamageProtection, ProtectionClaim } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProtectionClaimDialog from '~/components/reservations/ProtectionClaimDialog.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useImageViewer } from '~/composables/useImageViewer'

function protection(claims: ProtectionClaim[] = []): DamageProtection {
  return {
    policyId: 'dp-standard',
    option: 'deposit',
    state: 'card_on_file',
    amount: 500,
    currency: 'USD',
    termsVersion: 'v1',
    termsText: 'Terms',
    acceptedAt: '2026-09-10T00:00:00.000Z',
    acceptedVia: 'guest_guide',
    claims,
  }
}

const REPORT: CleaningReportGroup = {
  jobId: 'cln-a',
  cleaningLabel: 'Check-out cleaning',
  reportedBy: 'Made Surya',
  reportedAt: '2026-09-20T05:30:00.000Z',
  findings: [
    { id: 'cln-a:problem:b-1', text: 'Cracked shower screen', checklistItem: 'Clean shower', photoUrls: ['/p/screen.jpg'] },
    { id: 'cln-a:problem:b-2', text: 'Sofa cover torn', checklistItem: 'Check furniture', photoUrls: ['/p/sofa.jpg'] },
  ],
}

async function mountDialog(props: { reports?: CleaningReportGroup[], claims?: ProtectionClaim[] } = {}) {
  const wrapper = mount(ProtectionClaimDialog, {
    props: { open: false, protection: protection(props.claims), reports: props.reports ?? [] },
    global: {
      // Unregistered auto-imports render as bare tags, so the value
      // assertions below would pass vacuously.
      components: { Button, Input, Label, Textarea },
      stubs: {
        Icon: true,
        // Honours `open`, so the claim dialog renders and its image viewer
        // stays shut until a photo is opened.
        Dialog: { props: ['open'], template: '<div v-if="open !== false"><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
      },
    },
  })
  // Opening runs the reset, the same as a real open.
  await wrapper.setProps({ open: true })
  return wrapper
}

/** jsdom has no object URLs, so the preview path is stubbed. */
function stubObjectUrls() {
  let n = 0
  const create = vi.fn(() => `blob:preview-${++n}`)
  const revoke = vi.fn()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
  return { create, revoke }
}

async function upload(wrapper: Awaited<ReturnType<typeof mountDialog>>, files: File[]) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function submitButton(wrapper: Awaited<ReturnType<typeof mountDialog>>) {
  return wrapper.findAll('button').find(b => b.text() === 'Record claim')!
}

describe('protectionClaimDialog', () => {
  it('says so when no cleaning report is linked, and still allows a manual claim', async () => {
    const wrapper = await mountDialog()
    expect(wrapper.find('[data-testid="claim-cleaning-reports"]').text()).toContain('No finished cleaning report is linked')
    expect(wrapper.find('#claim-label').exists()).toBe(true)
    expect(wrapper.text()).toContain('Add evidence')
  })

  it('says a report flagged nothing rather than hiding it', async () => {
    const wrapper = await mountDialog({ reports: [{ ...REPORT, findings: [] }] })
    expect(wrapper.text()).toContain('Flagged nothing.')
  })

  it('lists each finding as a Problem with its checklist line and photo count', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    const rows = wrapper.findAll('[data-testid="claim-finding"]')
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.text().includes('Problem'))).toBe(true)
    expect(rows[1]!.text()).toContain('Checklist: Check furniture')
    expect(rows[1]!.text()).toContain('1 photo')
    // The free-text damages list is never offered, so nothing is labelled Damage.
    expect(wrapper.find('[data-testid="claim-cleaning-reports"]').text()).not.toContain('Damage')
  })

  it('fills the label and reason from a finding and attaches the report as evidence', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    await wrapper.findAll('[data-testid="claim-finding"]')[0]!.trigger('click')

    expect((wrapper.find('#claim-label').element as HTMLInputElement).value).toBe('Cracked shower screen')
    expect((wrapper.find('#claim-reason').element as HTMLTextAreaElement).value).toContain('Reported by Made Surya')
    expect(wrapper.find('[data-testid="claim-evidence-cleaning"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="claim-finding"]')[0]!.attributes('aria-pressed')).toBe('true')
  })

  it('submits with the cleaning report as the only evidence once an amount is entered', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    await wrapper.findAll('[data-testid="claim-finding"]')[0]!.trigger('click')
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()

    await wrapper.find('#claim-amount').setValue('180')
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
    await submitButton(wrapper).trigger('click')

    const [draft] = wrapper.emitted('submit')![0] as [Record<string, unknown>]
    expect(draft).toMatchObject({
      label: 'Cracked shower screen',
      amount: 180,
      evidenceUrls: [],
      cleaningReport: { cleaningJobId: 'cln-a', findingId: 'cln-a:problem:b-1', photoUrls: ['/p/screen.jpg'] },
    })
  })

  it('blocks submit again when the cleaning report is removed and nothing else backs it', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    await wrapper.findAll('[data-testid="claim-finding"]')[0]!.trigger('click')
    await wrapper.find('#claim-amount').setValue('180')
    await wrapper.find('[aria-label="Remove the cleaning report"]').trigger('click')

    expect(wrapper.find('[data-testid="claim-evidence-cleaning"]').exists()).toBe(false)
    // The wording stays: staff may have edited it.
    expect((wrapper.find('#claim-label').element as HTMLInputElement).value).toBe('Cracked shower screen')
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('picking the same finding again detaches it but keeps the wording', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    const row = () => wrapper.findAll('[data-testid="claim-finding"]')[0]!
    await row().trigger('click')
    await row().trigger('click')
    expect(row().attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="claim-evidence-cleaning"]').exists()).toBe(false)
    expect((wrapper.find('#claim-label').element as HTMLInputElement).value).toBe('Cracked shower screen')
  })

  it('brings a problem\'s photos into the claim as evidence', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    await wrapper.findAll('[data-testid="claim-finding"]')[1]!.trigger('click')
    expect(wrapper.find('[data-testid="claim-evidence-cleaning"]').text()).toMatch(/Check-out cleaning report, .+, 1 photo$/)

    await wrapper.find('#claim-amount').setValue('60')
    await submitButton(wrapper).trigger('click')
    const [draft] = wrapper.emitted('submit')![0] as [{ cleaningReport: { checklistItem: string, photoUrls: string[] } }]
    expect(draft.cleaningReport.checklistItem).toBe('Check furniture')
    expect(draft.cleaningReport.photoUrls).toEqual(['/p/sofa.jpg'])
  })

  it('shows a problem\'s photo in its finding row, outside the row\'s select button', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    const [screenRow, sofaRow] = wrapper.findAll('[data-testid="claim-finding-row"]')
    expect(screenRow!.find('[data-testid="claim-photo"]').attributes('src')).toBe('/p/screen.jpg')
    expect(sofaRow!.find('[data-testid="claim-photo"]').attributes('src')).toBe('/p/sofa.jpg')
    // A button inside a button is unreachable, so the photo sits beside the select button.
    expect(sofaRow!.find('[data-testid="claim-finding"] [data-testid="claim-photo"]').exists()).toBe(false)
  })

  it('opens a finding\'s photo full size without picking the finding', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    const problemRow = wrapper.findAll('[data-testid="claim-finding-row"]')[1]!
    await problemRow.find('[data-testid="claim-photo-open"]').trigger('click')
    expect(useImageViewer('damage-claim').viewedImage.value).toMatchObject({
      url: '/p/sofa.jpg',
      caption: 'Sofa cover torn',
      senderName: 'Made Surya',
      timestamp: REPORT.reportedAt,
    })
    expect(problemRow.find('[data-testid="claim-finding"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="image-viewer"] img').attributes('src')).toBe('/p/sofa.jpg')
  })

  it('opens an evidence photo full size in the dialog\'s own viewer, never the inbox\'s', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    await wrapper.findAll('[data-testid="claim-finding"]')[1]!.trigger('click')
    const photos = wrapper.find('[data-testid="claim-evidence-cleaning-photos"]')
    expect(photos.find('[data-testid="claim-photo"]').attributes('src')).toBe('/p/sofa.jpg')
    expect(photos.find('a').exists()).toBe(false)
    await photos.find('[data-testid="claim-photo-open"]').trigger('click')
    expect(useImageViewer('damage-claim').viewedImage.value?.url).toBe('/p/sofa.jpg')
    expect(useImageViewer().viewedImage.value).toBeNull()
  })

  it('previews an uploaded image, keeps a PDF as a file row, and stores mock paths', async () => {
    const { create } = stubObjectUrls()
    const wrapper = await mountDialog()
    await upload(wrapper, [
      new File(['x'], 'lamp.jpg', { type: 'image/jpeg' }),
      new File(['x'], 'quote.pdf', { type: 'application/pdf' }),
    ])
    expect(create).toHaveBeenCalledTimes(1)
    const uploads = wrapper.find('[data-testid="claim-evidence-uploads"]')
    expect(uploads.find('[data-testid="claim-photo"]').attributes('src')).toBe('blob:preview-1')
    expect(wrapper.text()).toContain('quote.pdf')
    await uploads.find('[data-testid="claim-photo-open"]').trigger('click')
    expect(useImageViewer('damage-claim').viewedImage.value).toMatchObject({ url: 'blob:preview-1', senderName: 'lamp.jpg' })

    await wrapper.find('#claim-label').setValue('Broken lamp')
    await wrapper.find('#claim-amount').setValue('80')
    await wrapper.find('#claim-reason').setValue('Found at check-out')
    await submitButton(wrapper).trigger('click')
    const [draft] = wrapper.emitted('submit')![0] as [{ evidenceUrls: string[] }]
    // The preview is for staff only; the claim keeps the evidence paths.
    expect(draft.evidenceUrls).toEqual(['/mock/evidence/lamp.jpg', '/mock/evidence/quote.pdf'])
  })

  it('counts the same file picked twice once', async () => {
    stubObjectUrls()
    const wrapper = await mountDialog()
    const file = new File(['x'], 'lamp.jpg', { type: 'image/jpeg' })
    await upload(wrapper, [file])
    await upload(wrapper, [file])
    expect(wrapper.findAll('[data-testid="claim-evidence-uploads"] [data-testid="claim-photo"]')).toHaveLength(1)
  })

  it('removing an uploaded photo drops it and releases its preview', async () => {
    const { revoke } = stubObjectUrls()
    const wrapper = await mountDialog()
    await upload(wrapper, [new File(['x'], 'lamp.jpg', { type: 'image/jpeg' })])
    await wrapper.find('[aria-label="Remove lamp.jpg"]').trigger('click')
    expect(revoke).toHaveBeenCalledWith('blob:preview-1')
    expect(wrapper.find('[data-testid="claim-evidence-uploads"]').exists()).toBe(false)
  })

  it('says a photo is unavailable when it cannot load', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    await wrapper.findAll('[data-testid="claim-finding"]')[1]!.trigger('click')
    await wrapper.find('[data-testid="claim-evidence-cleaning-photos"] [data-testid="claim-photo"]').trigger('error')
    expect(wrapper.find('[data-testid="claim-evidence-cleaning-photos"] [data-testid="claim-photo-open"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="claim-evidence-cleaning-photos"]').text()).toContain('Photo unavailable')
  })

  it('disables a finding an earlier claim already carries', async () => {
    const earlier = {
      id: 'clm-1',
      label: 'Cracked shower screen',
      amount: 180,
      coveredAmount: 180,
      excessAmount: 0,
      reason: 'x',
      evidenceUrls: [],
      cleaningReport: {
        cleaningJobId: 'cln-a',
        findingId: 'cln-a:problem:b-1',
        finding: 'Cracked shower screen',
        checklistItem: 'Clean shower',
        photoUrls: ['/p/screen.jpg'],
        cleaningLabel: 'Check-out cleaning',
        reportedBy: 'Made Surya',
        reportedAt: REPORT.reportedAt,
      },
      recordedBy: 'Komang Juliantara',
      recordedAt: REPORT.reportedAt,
    } satisfies ProtectionClaim
    const wrapper = await mountDialog({ reports: [REPORT], claims: [earlier] })
    const [claimed, open] = wrapper.findAll('[data-testid="claim-finding"]')
    expect(claimed!.attributes('disabled')).toBeDefined()
    expect(claimed!.text()).toContain('Claimed')
    expect(open!.attributes('disabled')).toBeUndefined()
  })

  it('names both routes to evidence when neither is given', async () => {
    const wrapper = await mountDialog({ reports: [REPORT] })
    expect(wrapper.text()).toContain('A cleaning report, a photo or a document. Either one is enough.')
  })
})
