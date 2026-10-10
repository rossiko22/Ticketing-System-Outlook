### Ticketing System Outlook
This is a web application for managing incoming Outlook emails as tickets. The goal is to help a support team organize its mailbox, assign responsibility, and track and have complete log of done work.

## Project Status

Early development. The main mailbox page now supports Microsoft Graph mail import and PostgreSQL persistence. See [Microsoft Graph setup](documentation/microsoft-graph.md) for credentials, permissions, commands and current limitations.

The checklist below tracks the broader planned feature set.

## Planned Features

- [ ] Email and password login for existing accounts, without public registration or password recovery.
- [ ] Mailbox views for all, unassigned, and assigned emails.
- [ ] Search and filters, including ticket status and the user who completed a ticket.
- [x] Manual Outlook Inbox synchronization and persistent email records in PostgreSQL.
- [ ] An email reading view with sender information, message content, and attachments.
- [ ] Assignment of tickets to another user or to the current user.
- [ ] Ticket completion restricted to the assigned user.
- [ ] Replies sent through the connected mailbox and retained in the application.
- [ ] Email archive export in a format suitable for later import, such as EML.
- [ ] A settings page.

## Planned Technology Stack

| Area | Technology |
| --- | --- |
| Backend | Node.js, Express, TypeScript |
| Frontend | HTML, CSS, vanilla JavaScript |
| Database | PostgreSQL |
| Email integration | Microsoft Graph API for Outlook |
| Containerization | Docker and Docker Compose |

## Architecture

The application is designed as a **modular monolith with layers inside each feature module**.

- **Monolith:** one Express application serves the API and frontend files and is deployed as one application.
- **Modules:** authentication, users, tickets, and emails are organized by feature.
- **Layers:** routes map HTTP endpoints, controllers handle requests and responses, services enforce business rules, and repositories access the database.

Modules should communicate through deliberate interfaces rather than directly accessing each other's internal implementation.

## Planned Project Structure

| Directory or file | Purpose |
| --- | --- |
| `src/app.ts` | Express application configuration, middleware, and routes |
| `src/server.ts` | Application startup |
| `src/config/` | Environment and database configuration |
| `src/modules/` | Authentication, users, tickets, and email modules |
| `src/integrations/` | External service clients, including Outlook |
| `src/storage/` | Code for saving and retrieving files |
| `src/jobs/` | Background tasks, such as email synchronization |
| `src/middleware/` | Shared request middleware |
| `src/utils/` | Shared utilities |
| `src/types/` | Shared TypeScript declarations |
| `public/` | HTML pages, CSS, browser JavaScript, and public static assets |
| `database/migrations/` | Database schema changes |
| `database/seeds/` | Development seed data |
| `storage/` | Persistent runtime files; excluded from Git |
| `tests/` | Automated tests |
| `dist/` | Generated backend build output; excluded from Git |

## Local Development

Setup instructions are pending until the application can be run locally.

<!-- Replace the placeholders below with verified instructions. Do not publish guessed commands as working setup steps. -->

### Requirements

- Node.js: [version used by this project]
- npm: [version used by this project]
- PostgreSQL: [version used by this project]
- Docker and Docker Compose: [whether required or optional]

### Setup Steps

1. Clone the repository: [repository URL and command].
2. Install dependencies: [verified command].
3. Configure the environment: [instructions based on `.env.example`].
4. Start the database: [verified command or instructions].
5. Apply database migrations: [verified command].
6. Start the development server: [verified command].
7. Open the application: [local URL].

### Environment Variables

Document variables here as they are introduced and keep `.env.example` aligned with the application. Use placeholder values for secrets; keep the actual `.env` file out of Git.

| Variable | Purpose | Required | Example without secrets |
| --- | --- | --- | --- |
| [VARIABLE_NAME] | [What it configures] | [Yes/No] | [Example value] |

### Available Commands

Add entries only after the corresponding scripts exist in `package.json` and have been verified.

| Command | Purpose |
| --- | --- |
| [Development command] | Start the development server |
| [Build command] | Compile the backend |
| [Production command] | Start the compiled application |
| [Test command] | Run automated tests |

## Testing

Tests are planned. Document the test command, any database setup required, and the behavior covered once tests are added.

## Author

Marko Spasovski
