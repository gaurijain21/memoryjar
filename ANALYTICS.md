# Memory Jar Analytics

Memory Jar initializes Firebase Analytics / GA4 in the browser only when
`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` is configured and Analytics is supported.

Firebase Analytics / GA4 will show active users, page views, custom events, and
event counts. For ranges like last day, last 15 days, and total, use the
Firebase Analytics or GA4 dashboard date range filters.

Custom events such as `login_success`, `group_created`, `group_joined`,
`memory_created`, `photo_uploaded`, and `button_clicked` will appear after
events are collected by GA4.
