(() => {
  class AppNavbar extends HTMLElement {
    connectedCallback() {
      this.innerHTML = '<nav class="topbar" aria-label="Your profile"><div class="profile"><span class="avatar" data-user-initial aria-hidden="true"></span><div><strong data-current-user>Loading…</strong><small data-current-role></small></div></div></nav>';
    }
  }
  customElements.define('app-navbar', AppNavbar);
})();
