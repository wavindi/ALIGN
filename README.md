# Cyncro Operational Suite

Cyncro is an inventory counting and reconciliation web app for PC workstations. The `main` branch is a no-database demo/deployment build that runs on Vercel or a local Linux server without SQLite, Prisma, or any `DATABASE_URL`.

Data is stored in server memory for the active runtime only. That keeps deployment simple for demos, but changes reset when the Vercel function or local server restarts. Use branch `V1` when you want the local SQLite database version.

## Default Users

All starter users use the password `align`.

- `counter`
- `finance`
- `admin`

## First-Time Local Setup

```powershell
npm install
npm run build
npm start
```

Open:

```text
http://127.0.0.1:3000
```

## Vercel Deployment

This branch does not need environment variables or a database.

1. Import `https://github.com/wavindi/Cyncro.git` in Vercel.
2. Select branch `main`.
3. Keep the default Next.js settings.
4. Build command:

```bash
npm run build
```

## Linux Server Setup

On a Linux server:

```bash
git clone https://github.com/wavindi/Cyncro.git
cd Cyncro
chmod +x setup
./setup
```

The setup file installs prerequisites, installs a compatible Node.js version on Debian/Ubuntu if needed, installs npm dependencies, builds the app, and starts Cyncro on:

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
New-NetFirewallRule -DisplayName "Cyncro Local Server 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## Current Architecture

- Next.js App Router UI
- API routes for login, counts, finance actions, admin actions, and audit logging
- In-memory runtime store for no-database deployment
- XLSX import/export support

For persistent production data, use the `V1` branch as the local SQLite reference or upgrade `main` to hosted PostgreSQL.
