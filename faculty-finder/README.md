# Campusmitra — Smart Faculty Finder & Campus Availability System

Standalone VS Code project folder for **Campusmitra (Faculty Finder)**.

## Run in VS Code

1. Open the **`faculty-finder`** folder directly in VS Code (`File -> Open Folder... -> faculty-finder`).
2. Open the VS Code Integrated Terminal (`Ctrl + ~`) and run:
   ```bash
   npm install
   npm run dev
   ```
   Or press **`F5`** in VS Code using the included `.vscode/launch.json` configuration.
3. Open **http://localhost:3001** in your browser.

> Note: On first launch, `data/campusmitra.db` is created and seeded automatically with two isolated colleges (`NITM` and `MEC`), faculty profiles, timetables, buildings with OpenStreetMap coordinates, virtual queues, and appointments.

## Production Build

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

## Development Demo Accounts (Password: `Campus@2026`)

| Role | Name | College | Email / ID |
| :--- | :--- | :--- | :--- |
| **Student** | Aryan Mehta | NITM | `aryan.mehta@nitm.edu` / `STU202401` |
| **Faculty** | Dr. Anand Deshmukh | NITM | `dr.anand@nitm.edu` / `FAC101` |
| **Faculty** | Prof. Kavita Nair | NITM | `prof.kavita@nitm.edu` / `FAC102` |
| **Admin** | Rajesh Kulkarni | NITM | `admin@nitm.edu` / `ADM001` |
| **Student (Isolated College)** | Priya Nair | MEC | `priya.nair@mec.edu` / `MEC202401` |
| **Admin (Isolated College)** | Vikram Patil | MEC | `admin@mec.edu` / `MECADM01` |
