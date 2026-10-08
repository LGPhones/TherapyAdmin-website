# TherapyAdmin AI Frontend

This is the React + Vite frontend for TherapyAdmin AI. It connects to the Express backend to perform clinician calibration, document generation, and packet orchestration.

## Configuration & Custom Ports

By default, the frontend expects the backend API to be running at `http://localhost:3001/api`.

If you change the backend port (e.g., to port `5000` via the backend `.env` file), you can configure the frontend to target the new port in one of two ways:

### Option A: Create a `.env` file
Create a file named `.env` in this `frontend` directory and define your custom backend URL:
```env
VITE_API_BASE=http://localhost:5000/api
```

### Option B: Command line injection
You can inject the variable on startup directly:
```bash
VITE_API_BASE=http://localhost:5000/api npm run dev
```

---

## Development commands

### Install dependencies
```bash
npm install
```

### Start development server
```bash
npm run dev
```

### Build for production
```bash
npm run build
```

### Run static code analysis (Linter)
```bash
npm run lint
```
