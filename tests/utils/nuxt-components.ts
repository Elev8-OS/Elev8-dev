import { defineComponent, h } from 'vue'

/**
 * Stand-in for Nuxt's virtual `#components` module, which only exists inside
 * a Nuxt build. Data files such as `tasks/data/data.ts` import `Icon` from it
 * to render table cells; aliased here in `vitest.config.ts` so those files can
 * load in a spec.
 */
export const Icon = defineComponent({
  name: 'Icon',
  props: { name: { type: String, default: '' } },
  setup(props) {
    return () => h('i', { 'data-icon': props.name })
  },
})
