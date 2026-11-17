# Campus QuickPrint — QR Print Ordering & Counter Management Platform

A mobile-first QR code print ordering system for local copy shops, print centers, and bookstores. Customers scan an in-shop QR code on their phone or desktop, upload PDFs, configure print settings, see an instant transparent price estimate, and submit to the counter. The shopkeeper reviews, approves, prints, and manages orders from a dedicated queue dashboard.

---

## 🚀 Key Features

### 📱 Customer Experience (Mobile-First & Desktop Widescreen)
- **Instant In-Shop QR Access:** No login or app installation required.
- **Client-Side Page Detection:** Drag-and-drop PDF upload with instant page counting.
- **Print Configuration Matrix:**
  - Black & White vs Full Color
  - Single-Sided vs Double-Sided (Duplex sheet-savings math)
  - Paper Sizes: A4, Letter, Legal, A3
  - Multi-copy stepper & custom page ranges (e.g. `1-4, 7, 9-11`)
- **Transparent Counter Pricing:** Real-time formula breakdown with ₹0 online platform fee.
- **Sequential Queue Reference:** Displays queue token (e.g. `#1041`) with live 5-stage progress tracker.

### ⏱️ 10-Minute Database Auto-Purge Privacy Lifecycle
- **Zero Database Bloat:** When a document is downloaded or printed at the counter, a **10-minute auto-purge countdown** begins.
- **Permanent Binary Wipe:** Exactly 10 minutes post-download/print, the PDF file binary is permanently purged from storage.
- **Audit Accounting Preserved:** The financial receipt, queue ID, customer name, and transaction amount remain intact for store accounts.
- **Instant Override:** Shopkeeper can click **"Purge Now"** at any time to immediately delete the file.

### 🖥️ Shop Owner Operational Dashboard
- **Arrival-Ordered Queue:** Filterable by *Needs Action*, *Printing*, *Ready*, and *Archive*.
- **Inspector Drawer:** Complete print specifications, arrival timestamps, and 1-click customer WhatsApp messaging.
- **Action Workflow:** Approve Job, Reject with reason, Request Clarification, or Revise Quote.
- **Print & Download:** Launch browser print dialog or download original PDF.

### 🖨️ Hardware & Infrastructure
- **Windows Desktop Companion (`desktop_print_agent.py`):** Background Python script to silently spool PDFs directly to Windows default printers (`win32print`) without opening browser print prompts.
- **Production SQL Schema (`schema.sql`):** PostgreSQL / Supabase schema with automated cleanup procedure and Row-Level Security (RLS).
- **Printable Counter Signage Poster:** Generates a ready-to-print acrylic standee poster with live QR code in the Settings tab.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Design Tokens:** Notion editorial tokens (Inter typography, rectangular 8px controls, 12px cards, subtle hairlines, signature `#5645d4` purple primary CTA)
- **Icons:** Lucide React
- **Reactivity:** `BroadcastChannel` + `localStorage` real-time cross-tab synchronization

---

## 💻 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/abhivarmanadimpalli1/print.git
cd print
npm install
```

### 2. Run Development Server
```bash
npm run dev -- --port 5173
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```

---

## 📁 Project Structure

```
work/
├── src/
│   ├── components/
│   │   ├── customer/       # CustomerOrderFlow, PaymentModal, CustomerOrderStatus
│   │   ├── layout/         # Notion-style Header with view switcher
│   │   ├── shop/           # ShopDashboard, RejectOrderModal, ClarifyModal, PrintModal, ShopSettings
│   │   └── ui/             # Reusable Button, Card, Input, Badge
│   ├── lib/
│   │   ├── store.ts        # LocalStorage + BroadcastChannel sync + 10m auto-purge engine
│   │   ├── samplePdf.ts    # Lightweight valid PDF binary generator
│   │   └── pageRangeParser.ts # Custom page range parser & validator
│   ├── types/              # TypeScript definitions for shops, orders, and print configs
│   ├── App.tsx             # Root app & view router
│   └── index.css           # Tailwind v4 theme & Notion tokens
├── desktop_print_agent.py  # Windows desktop printer spooling daemon
├── schema.sql              # Production PostgreSQL/Supabase schema & auto-cleanup function
└── vite.config.ts
```

---

## 🔒 Document Privacy & Retention

Uploaded customer files are strictly isolated to temporary operational queues. Files are automatically deleted from memory and storage 10 minutes following counter download or printing.
