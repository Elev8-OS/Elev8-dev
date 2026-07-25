import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'General',
    items: [
      {
        title: 'Home',
        icon: 'i-lucide-home',
        link: '/',
      },
      {
        title: 'Email',
        icon: 'i-lucide-mail',
        link: '/email',
      },
      {
        title: 'Inbox',
        icon: 'i-lucide-inbox',
        link: '/inbox',
        new: true,
      },
      {
        title: 'Tasks',
        icon: 'i-lucide-calendar-check-2',
        link: '/tasks',
      },
      {
        title: 'Cleaning Calendar',
        icon: 'i-lucide-calendar-range',
        link: '/cleaning-calendar',
      },
      {
        title: 'Operations Calendar',
        icon: 'i-lucide-calendar-days',
        link: '/operations-calendar',
        new: true,
      },
      {
        title: 'Upsells',
        icon: 'i-lucide-tag',
        link: '/upsells',
        new: true,
      },
      {
        title: 'Inventory',
        icon: 'i-lucide-package',
        link: '/inventory',
        new: true,
      },
      {
        title: 'Key Management',
        icon: 'i-lucide-key-round',
        link: '/key-management',
        new: true,
      },
      {
        title: 'Procurement',
        icon: 'i-lucide-shopping-cart',
        link: '/procurement',
        new: true,
      },
      {
        title: 'Listings',
        icon: 'i-lucide-building',
        link: '/listings',
        new: true,
      },
      {
        title: 'Users',
        icon: 'i-lucide-users-round',
        link: '/users',
        new: true,
      },
      {
        title: 'Owners',
        icon: 'i-lucide-building-2',
        link: '/owners',
        new: true,
      },
      {
        title: 'Owner Statements',
        icon: 'i-lucide-file-chart-column',
        link: '/owner-statements',
        new: true,
      },
      {
        title: 'Review Hub',
        icon: 'i-lucide-message-square-text',
        link: '/reviews',
        new: true,
      },
      {
        title: 'Owner Portal (Demo)',
        icon: 'i-lucide-external-link',
        link: '/owner-portal/login',
        new: true,
      },
    ],
  },
  {
    heading: 'Finance',
    items: [
      {
        title: 'Finance',
        icon: 'i-lucide-receipt',
        link: '/finance',
        new: true,
      },
      {
        title: 'Payment Requests',
        icon: 'i-lucide-link',
        link: '/payment-requests',
        new: true,
      },
    ],
  },
  {
    heading: 'Smart Flow',
    items: [
      {
        title: 'Journeys',
        icon: 'i-lucide-route',
        link: '/journeys',
        new: true,
      },
    ],
  },
  {
    heading: 'Apps',
    items: [
      {
        title: 'Platform Console',
        icon: 'i-lucide-layers',
        link: '/platform-console',
        new: true,
      },
      {
        title: 'Kanban Board',
        icon: 'i-lucide-kanban',
        link: '/kanban',
        new: true,
      },
      {
        title: 'Website Builder',
        icon: 'i-lucide-globe',
        link: '/website-builder',
        new: true,
      },
      {
        title: 'Promo Codes',
        icon: 'i-lucide-ticket-percent',
        link: '/promo-codes',
        new: true,
      },
      {
        title: 'Booking Widgets',
        icon: 'i-lucide-code-2',
        children: [
          {
            title: 'v1 (Full)',
            icon: 'i-lucide-circle',
            link: '/booking-widgets/v1',
          },
          {
            title: 'v2 (Simple)',
            icon: 'i-lucide-circle',
            link: '/booking-widgets',
          },
        ],
      },
      {
        title: 'Guest Guides',
        icon: 'i-lucide-book-open',
        link: '/guest-guides',
        new: true,
      },
      {
        title: 'Backfill Guides',
        icon: 'i-lucide-database',
        link: '/guest-guides/backfill',
      },
    ],
  },
  {
    heading: 'Pages',
    items: [
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
