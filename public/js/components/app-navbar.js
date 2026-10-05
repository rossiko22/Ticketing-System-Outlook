// Compact header actions, placed alongside the page title.
(() => {
  const template = document.createElement('template');
  template.innerHTML = `<nav class="topbar" aria-label="Header actions">
        <a class="mobile-compose icon-button" href="compose.html" aria-label="Compose new message"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></a>
        <div class="topbar-actions">
          <button type="button" class="icon-button" aria-label="Notifications" title="Notifications" data-action="notifications" ><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg></button>
          <button type="button" class="icon-button" aria-label="Documentation and help" title="Documentation and help" data-action="help" ><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1"/></svg></button>
          <div class="profile">
            <img class="avatar" src="assets/images/alex-chen.png" alt="" width="44" height="44">
            <div>
              <strong>Alex Chen</strong><small class="mono">(IT Operations)</small>
            </div>
          </div>
        </div>
      </nav>`;

  class AppNavbar extends HTMLElement {
    connectedCallback() {
      if (!this.firstElementChild) this.render();
    }

    render() {
      this.replaceChildren(template.content.cloneNode(true));
    }
  }
  customElements.define('app-navbar', AppNavbar);
})();
