<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { cn } from '@/lib/utils'
import PasswordInput from '~/components/PasswordInput.vue'

const { startSignup } = useAuthSignup()
const { startTenant } = useOnboarding()

const isLoading = ref(false)

const signUpSchema = toTypedSchema(z.object({
  name: z
    .string({ required_error: 'Required.' })
    .min(2, 'Name must be at least 2 characters.')
    .max(60, 'Name must not be longer than 60 characters.'),
  email: z
    .string({ required_error: 'Required.' })
    .min(1, 'Required.')
    .email('Enter a valid email address.'),
  password: z
    .string({ required_error: 'Required.' })
    .min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z
    .string({ required_error: 'Required.' })
    .min(1, 'Required.'),
}).refine(values => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
}))

async function onSubmit(values: Record<string, any>) {
  isLoading.value = true

  // Mock account creation. There is no auth backend yet.
  await new Promise(resolve => setTimeout(resolve, 1200))

  startSignup({ name: values.name, email: values.email })
  // The tenant record starts here, at `registered` (PRD 6.1).
  startTenant(values.email)
  isLoading.value = false

  toast.success(`We sent a verification code to ${values.email}`)
  navigateTo('/otp')
}
</script>

<template>
  <div :class="cn('grid gap-6', $attrs.class ?? '')">
    <Form
      :validation-schema="signUpSchema"
      class="grid gap-4"
      @submit="onSubmit"
    >
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input
              placeholder="Enter your name"
              type="text"
              autocapitalize="words"
              autocomplete="name"
              autocorrect="off"
              :disabled="isLoading"
              v-bind="componentField"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="email">
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input
              placeholder="name@example.com"
              type="email"
              autocapitalize="none"
              autocomplete="email"
              autocorrect="off"
              :disabled="isLoading"
              v-bind="componentField"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="password">
        <FormItem>
          <FormLabel>Password</FormLabel>
          <FormControl>
            <PasswordInput
              autocomplete="new-password"
              :disabled="isLoading"
              :component-field="componentField"
            />
          </FormControl>
          <FormDescription>
            At least 8 characters.
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="confirmPassword">
        <FormItem>
          <FormLabel>Confirm Password</FormLabel>
          <FormControl>
            <PasswordInput
              placeholder="Re-enter your password"
              autocomplete="new-password"
              :disabled="isLoading"
              :component-field="componentField"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <Button type="submit" :disabled="isLoading">
        <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
        Create account
      </Button>
    </Form>
    <Separator label="Or continue with" />
    <div class="flex items-center gap-4 flex-col">
      <Button type="button" variant="outline" class="w-full gap-2" :disabled="isLoading">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
          <path
            d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
            fill="currentColor"
          />
        </svg>
        Apple
      </Button>
      <Button type="button" variant="outline" class="w-full gap-2" :disabled="isLoading">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="size-4">
          <path
            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
            fill="currentColor"
          />
        </svg>
        Google
      </Button>
    </div>
  </div>
</template>
