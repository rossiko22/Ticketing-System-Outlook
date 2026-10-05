// Shared mailbox controls, list and feedback states. Uses light DOM.
(() => {
  const template = document.createElement('template');
  template.innerHTML = `<section class="mail-feed" aria-label="Email tickets">
            <form class="feed-controls" id="mail-filters" role="search">
              <div class="row">
                <div class="search-field">
                  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><label class="sr-only" for="mail-search">Search this mailbox</label><input class="input" type="search" id="mail-search" name="search" placeholder="Search sender, subject, or content…">
                </div>
                <button type="button" class="icon-button" aria-label="Sync Outlook mailbox" title="Sync Outlook mailbox" data-action="sync-mailbox" ><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/></svg></button>
              </div>
              <div class="feed-selects">
                <div>
                  <label class="field-label" for="ticket-status">Status</label>
                  <select class="input" id="ticket-status" name="status">
                    <option value="all">All (128)</option>
                    <option value="unassigned">Unassigned (7)</option>
                    <option value="progress">In progress (18)</option>
                    <option value="finished">Finished (103)</option>
                  </select>
                </div>
                <div>
                  <label class="field-label" for="sort-order">Sort</label>
                  <select class="input" id="sort-order" name="sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
                </div>
              </div>
              <div class="filter-grid">
                <label class="sr-only" for="assignee-filter">Filter by assignee</label>
                <select class="input" id="assignee-filter" name="assignee"><option value="">Assignee: All</option><option value="alex">Alex Chen</option><option value="sarah">Sarah Jenkins</option><option value="david">David Kim</option><option value="elena">Elena Rostova</option></select>
                <label class="sr-only" for="completed-by-filter">Filter by completed user</label>
                <select class="input" id="completed-by-filter" name="completedBy"><option value="">Closed by: Any</option><option value="alex">Alex Chen</option><option value="sarah">Sarah Jenkins</option><option value="david">David Kim</option></select>
                <button class="button button--small" type="reset">Reset filters</button>
              </div>
            </form>
            <div class="feed-list" id="ticket-list">
              <!-- Toggle these states and the ticket items from your mailbox controller. -->
              <div class="empty-state" id="mail-loading" role="status" hidden>
                Loading your mailbox…
              </div>
              <div class="notice notice--error" id="mail-error" role="alert" hidden>
                Could not load emails. Please try syncing again.
              </div>
              <div class="empty-state" id="no-results" hidden>
                <h2>No matching emails</h2><p>Try another search or reset your filters.</p>
              </div>
            </div>
          </section>`;
  const statusPages = { all: 'app.html', unassigned: 'unassigned.html', progress: 'assigned.html', finished: 'finished.html' };

  class MailFeed extends HTMLElement {
    static observedAttributes = ['status', 'tickets', 'selected-ticket', 'new-mail'];

    connectedCallback() {
      if (!this.firstElementChild) this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (this.isConnected && oldValue !== newValue) this.render();
    }

    render() {
      this.replaceChildren(template.content.cloneNode(true));
      const status = this.getAttribute('status') || 'all';
      const select = this.querySelector('#ticket-status');
      for (const option of select.options) option.defaultSelected = option.value === status;
      select.addEventListener('change', () => {
        const page = statusPages[select.value];
        if (page) location.assign(page);
      });
      // Keep Enter in the search field from reloading this static preview.
      this.querySelector('form').addEventListener('submit', event => event.preventDefault());
      const list = this.querySelector('#ticket-list');
      const empty = this.querySelector('#no-results');
      const ids = (this.getAttribute('tickets') || '').split(/\s+/).filter(Boolean);
      for (const id of ids) {
        const card = document.createElement('ticket-card');
        card.setAttribute('ticket-id', id);
        card.toggleAttribute('selected', id === this.getAttribute('selected-ticket'));
        list.insertBefore(card, empty);
      }
      if (this.hasAttribute('new-mail')) {
        const notice = document.createElement('div');
        notice.className = 'new-mail-notice';
        notice.setAttribute('role', 'status');
        notice.textContent = '1 new email received from Outlook';
        list.before(notice);
      }
    }
  }
  customElements.define('mail-feed', MailFeed);
})();
