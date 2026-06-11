# ALIGN Operational Suite

ALIGN is a local-server inventory counting and reconciliation app. This development setup runs the web app and database on this PC, while other PCs on the same network can connect through this PC's IP address.

## Local Database

The app currently uses SQLite through Prisma.

- Database file: `dev.db`
- Connection string: `.env`
- Starter password for seeded users: `align`

Seeded users:

- `counter`
- `finance`
- `admin`

The first `/api/state` request seeds the starter data if the database is empty.

## First-Time Setup

```powershell
npm install
npm run db:generate
npm run db:push
npm run build
```

## Linux Server Setup

On the Linux server, clone the repo and run the setup file:

```bash
git clone https://github.com/wavindi/ALIGN.git
cd ALIGN
chmod +x setup
./setup
```

The setup file installs Linux build tools, installs a compatible Node.js version on Debian/Ubuntu if needed, installs npm dependencies, creates `.env`, prepares the SQLite database, builds the app, and starts ALIGN on:

```text
http://SERVER-IP:3000
```

Run on another port:

```bash
PORT=4000 ./setup
```

Run as a persistent Linux service:

```bash
./setup --service
sudo systemctl status align
sudo journalctl -u align -f
```

Default login users are `counter`, `finance`, and `admin`. The default password is `align`.

## Run For LAN Testing

For development testing with other PCs:

```powershell
npm run dev:lan
```

For production-style local testing:

```powershell
npm run build
npm start
```

The local machine can open:

```text
http://127.0.0.1:3000
```

Other users on the same network should open:

```text
http://YOUR-PC-IP:3000
```

Find this PC's IPv4 address:

```powershell
ipconfig
```

If Windows Firewall blocks access, run PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "ALIGN Local Server 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## Useful Database Commands

Reset the local database:

```powershell
npm run db:reset
```

Open Prisma Studio:

```powershell
npm run db:studio
```

## Current Architecture

- Next.js App Router UI
- API routes for login, counts, finance actions, admin actions, and audit logging
- Prisma ORM
- SQLite local database
- XLSX import/export support

When the workflow is approved, the next deployment upgrade is PostgreSQL on the final local server.
