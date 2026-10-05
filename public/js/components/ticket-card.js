// Shared card renderer and sample data for the static mailbox pages.
(() => {
  const fixtures = {
  "TK-8941": {
    "id": "TK-8941",
    "sender": "Marcus Vance",
    "department": "DevOps",
    "time": "09:42 AM",
    "subject": "VPN gateway connection timeout for Berlin office staff",
    "preview": "Hey triage team, multiple remote team members in Mitte are getting disconnect error code 0x8007274C upon 2FA handshake verification…",
    "status": "unassigned",
    "footer": "#TK-8941",
    "unread": true,
    "href": "unassigned.html#ticket-detail"
  },
  "TK-9042": {
    "id": "TK-9042",
    "sender": "Rachel Green",
    "department": "Finance Ops",
    "time": "08:15 AM",
    "subject": "Urgent: Payroll export script failing with TLS handshake error",
    "preview": "The automated 08:00 UTC batch run just crashed. We have 450 contractor disbursements blocked. Log output attached.",
    "status": "progress",
    "footer": "#TK-9042",
    "unread": true,
    "href": "assigned-to-me.html#ticket-detail"
  },
  "INF-4921": {
    "id": "INF-4921",
    "sender": "Keith Miller",
    "department": "Infrastructure",
    "time": "07:10 AM",
    "subject": "Database migration lock warning on Customer DB Replica",
    "preview": "Postgres advisory lock threshold exceeded during step 4 of customer partition re-indexing. Need immediate triage on replica-02 before failover kicks in…",
    "status": "progress",
    "footer": "#INF-4921",
    "unread": true,
    "href": "assigned.html#ticket-detail"
  },
  "SEC-9921": {
    "id": "SEC-9921",
    "sender": "Elena Rostova",
    "department": "SecOps",
    "time": "Yesterday",
    "subject": "Okta SAML assertion signature rotation failure",
    "preview": "The X.509 signing certificate expired at 14:00 UTC. Azure AD / Okta relying party trust requires re-assertion with the newly issued certificate…",
    "status": "finished",
    "footer": "Completed by David Kim",
    "unread": false,
    "href": "finished.html#ticket-detail"
  },
  "TK-8940": {
    "id": "TK-8940",
    "sender": "Dr. Sophia Wagner",
    "department": "Finance",
    "time": "09:15 AM",
    "subject": "Urgent: NetSuite OAuth credential expiry notification",
    "preview": "Our automated reconciliation token expires in less than 48 hours. Can IT escalate the refresh key generation with Accounting ops?",
    "status": "unassigned",
    "footer": "#TK-8940",
    "unread": true
  },
  "TK-8939": {
    "id": "TK-8939",
    "sender": "Liam Patel",
    "department": "Engineering",
    "time": "08:50 AM",
    "subject": "Request for Docker Hub Enterprise access permissions",
    "preview": "New junior engineer onboarding today. Need read access to internal base container images and helm repos.",
    "status": "unassigned",
    "footer": "#TK-8939",
    "unread": true
  },
  "TK-8932": {
    "id": "TK-8932",
    "sender": "Claire Beauchamp",
    "department": "HR",
    "time": "Yesterday",
    "subject": "Security clearance badge provisioning — London Hub",
    "preview": "Please see attached guest roster and contractor badge authorization sheet for the upcoming quarterly audit.",
    "status": "unassigned",
    "footer": "#TK-8932",
    "unread": true
  },
  "TK-8927": {
    "id": "TK-8927",
    "sender": "Office Facilities Bot",
    "department": "IoT",
    "time": "Feb 23",
    "subject": "Automated Alert: Server Room 4 HVAC Delta Out of Bounds",
    "preview": "Sensor SR4-T2 reported 26.4°C over the 15-minute threshold. Secondary compressor switched to failover mode.",
    "status": "unassigned",
    "footer": "#TK-8927",
    "unread": true
  },
  "TK-8910": {
    "id": "TK-8910",
    "sender": "Marcus Rivera",
    "department": "IT Operations",
    "time": "Feb 22",
    "subject": "Outlook 365 Shared Mailbox delegation permissions",
    "preview": "Automated mailbox provisioning script executed successfully for the payroll team.",
    "status": "finished",
    "footer": "Completed by David Kim",
    "unread": false
  },
  "TK-8872": {
    "id": "TK-8872",
    "sender": "Jonas Lindqvist",
    "department": "IT Operations",
    "time": "Feb 22",
    "subject": "DKIM public key update for outbound mail gateway",
    "preview": "DNS selector verified against the compliance validator. TTL reset to 3600.",
    "status": "finished",
    "footer": "Completed by David Kim",
    "unread": false
  },
  "TK-8810": {
    "id": "TK-8810",
    "sender": "Tanya H.",
    "department": "IT Operations",
    "time": "Feb 22",
    "subject": "Exchange Hybrid Mail Connector TLS 1.3 deprecation notice",
    "preview": "Cipher suite compatibility audit completed for on-prem relay clusters.",
    "status": "finished",
    "footer": "Completed by David Kim",
    "unread": false
  }
};

  const statuses = { unassigned: 'Unassigned', progress: 'In progress', finished: 'Finished' };

  class TicketCard extends HTMLElement {
    static observedAttributes = ['ticket-id', 'selected'];

    // Assign API data with card.ticket = { id, sender, subject, preview, ... }.
    // Fixture lookup exists only for the static design examples.
    set ticket(value) {
      this._ticket = value;
      if (this.isConnected) this.render();
    }

    get ticket() {
      return this._ticket ?? fixtures[this.getAttribute('ticket-id')];
    }

    connectedCallback() {
      if (!this.firstElementChild) this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const ticket = this.ticket;
      if (!ticket) {
        this.textContent = 'Ticket unavailable.';
        return;
      }
      // Only HTTP(S) and relative links are allowed when API data is supplied.
      let href;
      if (ticket.href) {
        try {
          const url = new URL(ticket.href, document.baseURI);
          if (['http:', 'https:'].includes(url.protocol) ||
              (url.protocol === 'file:' && location.protocol === 'file:')) href = url.href;
        } catch { /* Render an action button for invalid links. */ }
      }
      const card = document.createElement(href ? 'a' : 'button');
      card.className = 'mail-item';
      card.dataset.ticketId = ticket.id;
      if (href) card.setAttribute('href', ticket.href);
      else {
        card.type = 'button';
        card.dataset.action = 'open-ticket';
      }
      if (this.hasAttribute('selected')) card.setAttribute('aria-current', 'true');
      const rowTag = href ? 'div' : 'span';
      // This template contains only static markup; ticket text uses textContent.
      card.innerHTML = `
        <${rowTag} class="mail-item-top">
          <span class="dot" aria-label="Unread"></span><strong></strong><span class="department"></span><time></time>
        </${rowTag}>
        <${href ? 'h3' : 'span class="mail-item-subject"'}></${href ? 'h3' : 'span'}>
        <${href ? 'p' : 'span class="mail-item-preview"'}></${href ? 'p' : 'span'}>
        <${rowTag} class="mail-item-footer">
          <span class="badge"><span class="dot" aria-hidden="true"></span><span data-status-label></span></span><span class="mono"></span>
        </${rowTag}>`;
      const text = (selector, value) => { card.querySelector(selector).textContent = value ?? ''; };
      text('strong', ticket.sender);
      text('.department', ticket.department);
      text('time', ticket.time);
      text('h3, .mail-item-subject', ticket.subject);
      text('p, .mail-item-preview', ticket.preview);
      const status = Object.hasOwn(statuses, ticket.status) ? ticket.status : 'unassigned';
      card.querySelector('.badge').classList.add(`badge--${status}`);
      text('[data-status-label]', statuses[status]);
      text('.mail-item-footer .mono', ticket.footer ?? `#${ticket.id}`);
      if (!ticket.unread) card.querySelector('.mail-item-top .dot').remove();
      this.replaceChildren(card);
    }
  }
  customElements.define('ticket-card', TicketCard);
})();
