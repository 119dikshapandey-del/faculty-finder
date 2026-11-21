# KT Buddy — Smart Backlog Management & Academic Information System

Standalone VS Code project folder for **KT Buddy**.

## Run in VS Code

1. Open the **`kt-buddy`** folder directly in VS Code (`File -> Open Folder... -> kt-buddy`).
2. Open the VS Code Integrated Terminal (`Ctrl + ~`) and run:
   ```bash
   npm install
   npm run dev
   ```
   Or press **`F5`** in VS Code using the included `.vscode/launch.json` configuration.
3. Open **http://localhost:3000** in your browser.

> Note: On first launch, `data/kt_buddy.db` is created and seeded automatically with realistic sample data and downloadable PDFs in `data/uploads/`.

## Production Build

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

## Development Demo Accounts

| Role | Name | Login ID / Email | Password |
| :--- | :--- | :--- | :--- |
| **Student** | Rahul Sharma (BCA Sem 4) | `BCA2024001` or `rahul.sharma@nitm.edu` | `KTBuddy@2026` |
| **Student** | Ananya Verma (BCA Sem 4) | `BCA2024002` or `ananya.verma@nitm.edu` | `KTBuddy@2026` |
| **Admin** | Rajeshwari Kulkarni (Exam Cell) | `admin@nitm.edu` | `KTBuddy@2026` |
