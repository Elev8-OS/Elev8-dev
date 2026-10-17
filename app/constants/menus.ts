import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'General',
    items: [
      { title: 'Home', icon: 'i-lucide-home', link: '/' },
      { title: 'Inbox', icon: 'i-lucide-inbox', link: '/inbox', new: true },
      { title: 'Analytics', icon: 'i-lucide-chart-column', link: '/analytics', new: true },
      {
        title: 'Bookings',
        icon: 'i-lucide-calendar-check',
        children: [
          { title: 'Reservations', link: '/reservations' },
          { title: 'Guest Registration', link: '/guest-registration' },
        ],
      },
      { title: 'Cockpit', icon: 'i-lucide-calendar-range', link: '/cockpit', new: true },
      {
        title: 'Properties',
        icon: 'i-lucide-building',
        children: [
          { title: 'Listings', link: '/listings' },
          { title: 'Channels', link: '/channels' },
        ],
      },
      { title: 'Listing Health', icon: 'i-lucide-trending-up', link: '/revenue', new: true },
      {
        title: 'Upsells',
        icon: 'i-lucide-tag',
        children: [
          { title: 'Catalog', link: '/upsells' },
          { title: 'Orders', link: '/upsell-orders' },
          { title: 'Damage Protection', link: '/damage-protection' },
        ],
      },
      {
        title: 'Guest Experience',
        icon: 'i-lucide-heart-handshake',
        children: [
          { title: 'Review Hub', link: '/reviews' },
          { title: 'Guest Guides', link: '/guest-guides' },
          { title: 'Backfill Guides', link: '/guest-guides/backfill' },
          { title: 'Journeys', link: '/journeys' },
        ],
      },
      {
        title: 'Marketing',
        icon: 'i-lucide-megaphone',
        children: [
          { title: 'Website Builder', link: '/website-builder' },
          { title: 'Promo Codes', link: '/promo-codes' },
          { title: 'Booking Widget v1 (Full)', link: '/booking-widgets/v1' },
          { title: 'Booking Widget v2 (Simple)', link: '/booking-widgets' },
        ],
      },
      {
        title: 'Finance',
        icon: 'i-lucide-receipt',
        children: [
          { title: 'Overview', link: '/finance' },
          { title: 'Payment Requests', link: '/payment-requests' },
          { title: 'City Tax', link: '/city-tax' },
        ],
      },
      { title: 'Owner Portal (Demo)', icon: 'i-lucide-external-link', link: '/owner-portal/login' },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { title: 'Tasks', icon: 'i-lucide-calendar-check-2', link: '/tasks' },
      {
        title: 'Members',
        icon: 'i-lucide-users',
        new: true,
        children: [
          { title: 'Users', link: '/users' },
          { title: 'Activities', link: '/activities' },
          { title: 'Attendance', link: '/attendance' },
          { title: 'Schedule', link: '/schedule' },
        ],
      },
      { title: 'Operations Calendar', icon: 'i-lucide-calendar-days', link: '/operations-calendar', new: true },
      { title: 'Key Management', icon: 'i-lucide-key-round', link: '/key-management', new: true },
      { title: 'Inventory', icon: 'i-lucide-package', link: '/inventory', new: true },
      { title: 'Procurement', icon: 'i-lucide-shopping-cart', link: '/procurement', new: true },    ],
  },
  {
    heading: 'Apps',
    items: [
      { title: 'Platform Console', icon: 'i-lucide-layers', link: '/platform-console', new: true },
      { title: 'Kanban Board', icon: 'i-lucide-kanban', link: '/kanban', new: true },
    ],
  },
  {
    heading: 'Pages',
    items: [
      {
        title: 'Tenant Onboarding',
        icon: 'i-lucide-rocket',
        link: '/onboarding',
        new: true,
      },
      {
        title: 'Authentication',
        icon: 'i-lucide-lock-keyhole-open',
        children: [
          {
            title: 'Login',
            icon: 'i-lucide-circle',
            link: '/login',
          },
          {
            title: 'Login Basic',
            icon: 'i-lucide-circle',
            link: '/login-basic',
          },
          {
            title: 'Register',
            icon: 'i-lucide-circle',
            link: '/register',
          },
          {
            title: 'Forgot Password',
            icon: 'i-lucide-circle',
            link: '/forgot-password',
          },
          {
            title: 'OTP',
            icon: 'i-lucide-circle',
            link: '/otp',
          },
          {
            title: 'OTP 1',
            icon: 'i-lucide-circle',
            link: '/otp-1',
          },
          {
            title: 'OTP 2',
            icon: 'i-lucide-circle',
            link: '/otp-2',
          },
        ],
      },
      {
        title: 'Errors',
        icon: 'i-lucide-triangle-alert',
        children: [
          {
            title: '401 - Unauthorized',
            icon: 'i-lucide-circle',
            link: '/401',
          },
          {
            title: '403 - Forbidden',
            icon: 'i-lucide-circle',
            link: '/403',
          },
          {
            title: '404 - Not Found',
            icon: 'i-lucide-circle',
            link: '/404',
          },
          {
            title: '500 - Internal Server Error',
            icon: 'i-lucide-circle',
            link: '/500',
          },
          {
            title: '503 - Service Unavailable',
            icon: 'i-lucide-circle',
            link: '/503',
          },
        ],
      },
      {
        title: 'Settings',
        icon: 'i-lucide-settings',
        new: true,
        children: [
          {
            title: 'Profile',
            icon: 'i-lucide-circle',
            link: '/settings/profile',
          },
          {
            title: 'Account',
            icon: 'i-lucide-circle',
            link: '/settings/account',
          },
          {
            title: 'Payouts',
            icon: 'i-lucide-circle',
            link: '/settings/payouts',
          },
          {
            title: 'Invoice Templates',
            icon: 'i-lucide-circle',
            link: '/settings/invoice-templates',
          },
          {
            title: 'Guide Content Templates',
            icon: 'i-lucide-circle',
            link: '/settings/guide-templates',
          },
          {
            title: 'Cleaning',
            icon: 'i-lucide-circle',
            link: '/settings/cleaning-templates',
          },
          {
            title: 'Guidance',
            icon: 'i-lucide-circle',
            link: '/settings/guidance',
          },
          {
            title: 'Integrations',
            icon: 'i-lucide-circle',
            link: '/settings/integrations',
          },
          {
            title: 'Appearance',
            icon: 'i-lucide-circle',
            link: '/settings/appearance',
          },
          {
            title: 'Branding',
            icon: 'i-lucide-circle',
            link: '/settings/branding',
          },
          {
            title: 'Notifications',
            icon: 'i-lucide-circle',
            link: '/settings/notifications',
          },
          {
            title: 'Display',
            icon: 'i-lucide-circle',
            link: '/settings/display',
          },
        ],
      },
    ],
  },
  {
    heading: 'Components',
    items: [
      {
        title: 'Components',
        icon: 'i-lucide-component',
        children: [
          {
            title: 'Accordion',
            icon: 'i-lucide-circle',
            link: '/components/accordion',
          },
          {
            title: 'Alert',
            icon: 'i-lucide-circle',
            link: '/components/alert',
          },
          {
            title: 'Alert Dialog',
            icon: 'i-lucide-circle',
            link: '/components/alert-dialog',
          },
          {
            title: 'Aspect Ratio',
            icon: 'i-lucide-circle',
            link: '/components/aspect-ratio',
          },
          {
            title: 'Avatar',
            icon: 'i-lucide-circle',
            link: '/components/avatar',
          },
          {
            title: 'Badge',
            icon: 'i-lucide-circle',
            link: '/components/badge',
          },
          {
            title: 'Breadcrumb',
            icon: 'i-lucide-circle',
            link: '/components/breadcrumb',
          },
          {
            title: 'Button',
            icon: 'i-lucide-circle',
            link: '/components/button',
          },
          {
            title: 'Calendar',
            icon: 'i-lucide-circle',
            link: '/components/calendar',
          },
          {
            title: 'Card',
            icon: 'i-lucide-circle',
            link: '/components/card',
          },
          {
            title: 'Carousel',
            icon: 'i-lucide-circle',
            link: '/components/carousel',
          },
          {
            title: 'Checkbox',
            icon: 'i-lucide-circle',
            link: '/components/checkbox',
          },
          {
            title: 'Collapsible',
            icon: 'i-lucide-circle',
            link: '/components/collapsible',
          },
          {
            title: 'Combobox',
            icon: 'i-lucide-circle',
            link: '/components/combobox',
          },
          {
            title: 'Command',
            icon: 'i-lucide-circle',
            link: '/components/command',
          },
          {
            title: 'Context Menu',
            icon: 'i-lucide-circle',
            link: '/components/context-menu',
          },
          {
            title: 'Dialog',
            icon: 'i-lucide-circle',
            link: '/components/dialog',
          },
          {
            title: 'Drawer',
            icon: 'i-lucide-circle',
            link: '/components/drawer',
          },
          {
            title: 'Dropdown Menu',
            icon: 'i-lucide-circle',
            link: '/components/dropdown-menu',
          },
          {
            title: 'Form',
            icon: 'i-lucide-circle',
            link: '/components/form',
          },
          {
            title: 'Hover Card',
            icon: 'i-lucide-circle',
            link: '/components/hover-card',
          },
          {
            title: 'Input',
            icon: 'i-lucide-circle',
            link: '/components/input',
          },
          {
            title: 'Item',
            icon: 'i-lucide-circle',
            link: '/components/item',
            new: true,
          },
          {
            title: 'kbd',
            icon: 'i-lucide-circle',
            link: '/components/kbd',
            new: true,
          },
          {
            title: 'Label',
            icon: 'i-lucide-circle',
            link: '/components/label',
          },
          {
            title: 'Menubar',
            icon: 'i-lucide-circle',
            link: '/components/menubar',
          },
          {
            title: 'Navigation Menu',
            icon: 'i-lucide-circle',
            link: '/components/navigation-menu',
          },
          {
            title: 'Number Field',
            icon: 'i-lucide-circle',
            link: '/components/number-field',
          },
          {
            title: 'Pagination',
            icon: 'i-lucide-circle',
            link: '/components/pagination',
          },
          {
            title: 'PIN Input',
            icon: 'i-lucide-circle',
            link: '/components/pin-input',
          },
          {
            title: 'Popover',
            icon: 'i-lucide-circle',
            link: '/components/popover',
          },
          {
            title: 'Progress',
            icon: 'i-lucide-circle',
            link: '/components/progress',
          },
          {
            title: 'Radio Group',
            icon: 'i-lucide-circle',
            link: '/components/radio-group',
          },
          {
            title: 'Range Calendar',
            icon: 'i-lucide-circle',
            link: '/components/range-calendar',
          },
          {
            title: 'Resizable',
            icon: 'i-lucide-circle',
            link: '/components/resizable',
          },
          {
            title: 'Scroll Area',
            icon: 'i-lucide-circle',
            link: '/components/scroll-area',
          },
          {
            title: 'Select',
            icon: 'i-lucide-circle',
            link: '/components/select',
          },
          {
            title: 'Separator',
            icon: 'i-lucide-circle',
            link: '/components/separator',
          },
          {
            title: 'Sheet',
            icon: 'i-lucide-circle',
            link: '/components/sheet',
          },
          {
            title: 'Skeleton',
            icon: 'i-lucide-circle',
            link: '/components/skeleton',
          },
          {
            title: 'Slider',
            icon: 'i-lucide-circle',
            link: '/components/slider',
          },
          {
            title: 'Sonner',
            icon: 'i-lucide-circle',
            link: '/components/sonner',
          },
          {
            title: 'Stepper',
            icon: 'i-lucide-circle',
            link: '/components/stepper',
          },
          {
            title: 'Switch',
            icon: 'i-lucide-circle',
            link: '/components/switch',
          },
          {
            title: 'Table',
            icon: 'i-lucide-circle',
            link: '/components/table',
          },
          {
            title: 'Tabs',
            icon: 'i-lucide-circle',
            link: '/components/tabs',
          },
          {
            title: 'Tags Input',
            icon: 'i-lucide-circle',
            link: '/components/tags-input',
          },
          {
            title: 'Textarea',
            icon: 'i-lucide-circle',
            link: '/components/textarea',
          },
          {
            title: 'Toast',
            icon: 'i-lucide-circle',
            link: '/components/toast',
          },
          {
            title: 'Toggle',
            icon: 'i-lucide-circle',
            link: '/components/toggle',
          },
          {
            title: 'Toggle Group',
            icon: 'i-lucide-circle',
            link: '/components/toggle-group',
          },
          {
            title: 'Tooltip',
            icon: 'i-lucide-circle',
            link: '/components/tooltip',
          },
        ],
      },
    ],
  },
]

export const navMenuBottom: NavMenuItems = [
  {
    title: 'Help & Support',
    icon: 'i-lucide-circle-help',
    link: '',
  },
  {
    title: 'Feedback',
    icon: 'i-lucide-send',
    link: '',
  },
]

export const platformConsoleNavMenu: NavMenu[] = [
  {
    heading: 'Platform Console',
    items: [
      { title: 'Tenants', icon: 'i-lucide-building-2', link: '/platform-console/tenants' },
      { title: 'Broadcasts', icon: 'i-lucide-megaphone', link: '/platform-console/broadcasts' },
      { title: 'Approvals', icon: 'i-lucide-check-circle', link: '/platform-console/approvals' },
      { title: 'Audit log', icon: 'i-lucide-file-clock', link: '/platform-console/audit' },
      { title: 'Settings', icon: 'i-lucide-settings', link: '/platform-console/settings' },
    ],
  },
]

export const platformConsoleNavMenuBottom: NavMenuItems = [
  { title: 'Back to tenant dashboard', icon: 'i-lucide-arrow-left', link: '/' },
]
