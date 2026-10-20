# Website Builder

- `/website-builder/create` is a 5-step wizard for a new site (Template, Settings, Property, Reviews, Preview). With `?edit=<id>` it renders `WebsiteEditor.vue` instead.
- **Edit layout** (`components/website-builder/WebsiteEditor.vue`): header (name, listing count, status icon, URL, Re-render, Unpublish, Save changes / Publish), left section nav, one section at a time. AI Generate (default) has quick suggestions, a prompt and a mock browser preview; nothing is sent anywhere. Site Settings, Manage Listings and Reviews embed `SettingsStep`, `PropertyStep` and `ReviewStep` with `embedded` (no Back / Next). Version History and Analytics read the website record; Hero Media, Blog, Surroundings, SEO and Cookie & Legal are empty states for now.
- Saving goes through `useWebsiteSave().saveWebsite()`, shared with `PreviewStep`. It writes the Website and hands the site's booking rules to `useWebsiteChannel().saveSiteRules()` (see `channels.md`). A website stores `propertyIds`, not rooms, so the editor only requires one property.
- The editor does not run the Reviews step's own validity check; it saves the selection as it stands.
