# Reusable Web Components

Edit these files once to update every page using the component:

- `js/components/app-sidebar.js`: sidebar navigation, mailbox counts, sync card, and current-user card.
- `js/components/app-navbar.js`: notification/help icons and profile, placed alongside the page heading.
- `js/components/ticket-card.js`: ticket-list card markup and shared sample ticket data.
- `js/components/mail-feed.js`: mailbox search, status/sort dropdowns, filters, ticket list, and feedback states.

```html
<script src="js/components/app-sidebar.js" defer></script>
<script src="js/components/app-navbar.js" defer></script>
<script src="js/components/ticket-card.js" defer></script>
<script src="js/components/mail-feed.js" defer></script>

<app-sidebar active="unassigned"></app-sidebar>
<!-- Place inside the page heading, beside its title. -->
<app-navbar></app-navbar>
<mail-feed status="unassigned" tickets="TK-8941 TK-8940" selected-ticket="TK-8941"></mail-feed>
```

`active` on the sidebar accepts `all`, `unassigned`, `assigned`, `mine`, `settings`, or `compose`; only matching links receive `aria-current="page"`. `version` overrides the default version label. The navbar contains only header actions and has no configuration attributes.

Cards use `ticket-id` to look up a sample fixture; `selected` is a boolean attribute (remove it to deselect). Set the `ticket` property to render real data instead:

```js
// Run after the deferred component scripts, or await customElements.whenDefined('ticket-card').
const card = document.createElement('ticket-card');
card.ticket = {
  id: 'TK-10001', sender: 'Jane Doe', department: 'Support',
  time: '10:30 AM', subject: 'New support request', preview: 'Message preview…',
  status: 'unassigned', unread: true,
};
document.querySelector('#ticket-list').append(card);
```

Statuses are `unassigned`, `progress`, and `finished`. An optional `href` renders a link; otherwise the card renders a button with `data-action="open-ticket"`. `footer` optionally replaces the default ticket number. Ticket text is inserted using `textContent`. Attribute changes re-render the relevant component; update a card by assigning its `ticket` property again.

Components render into **light DOM**, so existing global CSS, DOM queries, native links, and delegated `data-action` listeners continue to work. They keep the native `aside`, `header`, `nav`, link, and button semantics. Use one sidebar/navbar per page to keep IDs unique. Load controller scripts after component scripts or wait for `DOMContentLoaded` before querying their children. No framework, build step, fetch-based includes, or backend changes are required; direct file previews still work with JavaScript enabled.

Page-specific content, forms, toolbars, and dialogs remain in their HTML pages.

`mail-feed` accepts a space-separated `tickets` list, a `selected-ticket` ID, and a `status` of `all`, `unassigned`, `progress`, or `finished`. `new-mail` optionally shows the sample new-message notice. The status dropdown navigates between the existing static mailbox pages. Search, sort, assignee, and completion controls retain their integration hooks; actual API filtering still needs a controller. Reset restores the current page's status. Use one feed per page so form and feedback IDs remain unique.

The sidebar shows the Outlook sync status and manual sync action above the current-user card. The status is a static preview until connected to the mailbox controller; update `[data-sync-state]` and `[data-sync-status]` with actual sync results. The mail list has no footer.
