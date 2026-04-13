# Pudu CRM Web

React + TypeScript + Vite frontend for Pudu CRM.

## Setup

1. Copy `.env.example` to `.env` and set VITE_API_URL.
2. Run `npm install`.
3. Run `npm run dev` to start the dev server on http://localhost:5173.

## Scripts

- `npm run dev`: Start dev server with HMR
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint

## Features

- Modern SaaS UI with sidebar navigation
- Dashboard with widgets and insights
- Command bar with fuzzy search (⌘K)
- Right panel for detail views
- Multi-tenant authentication
- Responsive design with Tailwind CSS

## Tech Stack

- React 19 with TypeScript
- Vite for build tooling
- React Router for navigation
- TanStack Query for server state
- Tailwind CSS + Lucide icons
- Axios for API calls

## Environment

- `VITE_API_URL`: Backend API URL (default http://localhost:3001)
