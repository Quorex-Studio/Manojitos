# 🌸 Manojitos Bloom — Plataforma E-commerce + ERP/CRM con IA

<div align="center">

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

**Plataforma web integral de comercio electrónico y gestión empresarial para floristería de alto nivel con alcance nacional.**

</div>

-----

## 🚀 ¿Qué es esto?

Manojitos Bloom es una **Single Page Application (SPA) completa** que fusiona tres sistemas en uno:

- 🛒 **E-commerce B2C** — Tienda online con experiencia de compra premium
- 👤 **Portal de Clientes** — Panel personal con historial, crédito y métodos de pago
- ⚙️ **Backoffice ERP/CRM** — Sistema administrativo con IA integrada para gestión total del negocio

-----

## ✨ Características Principales

### 🛒 Módulo E-commerce (Storefront)

- Catálogo dinámico con filtros avanzados, categorías y vistas de detalle inmersivas
- Carrito de compras persistente y flujo de checkout completo
- Lista de deseos (Wishlist) sincronizada con la cuenta del usuario
- Notificaciones en tiempo real vía Supabase Realtime

### 👤 Portal de Clientes

- Autenticación segura con Supabase Auth + Row Level Security
- Dashboard personal: historial de pedidos y seguimiento de estado
- **“Mi Crédito”** — Billetera interna con saldo acumulable para futuras compras
- Gestión de métodos de pago

### ⚙️ Panel Administrativo (ERP/CRM)

- **Dashboard Analítico** — Reportes de ventas, ingresos y métricas clave del negocio
- **Gestión de Inventario** — CRUD completo + importación masiva automática de productos
- **CRM & Finanzas** — Control de ventas, cuentas por cobrar y créditos otorgados
- **Gestión de Proveedores** — Base de datos de relaciones comerciales
- **Motor de Precios** — Calculadora parametrizable de márgenes, envíos y precios automatizados

### 🤖 Asistente IA “Ángela” (4 modos)

|Modo              |Función                                               |
|------------------|------------------------------------------------------|
|💬 Chat de Soporte |Atención inmediata a dudas del usuario                |
|🎁 Personal Shopper|Recomendaciones de regalos según ocasión y presupuesto|
|🧮 Smart Calculator|Cotización inteligente de pedidos especiales          |
|📊 Copilot Admin   |Asistente de análisis para el backoffice              |

-----

## 🛠️ Stack Tecnológico

```
Frontend          → React 18 + TypeScript + TailwindCSS + shadcn/ui
Estado global     → Zustand + Context API
Data fetching     → TanStack Query (React Query v5)
Backend & DB      → Supabase (PostgreSQL + Auth + Realtime + Storage)
IA                → Integración LLM nativa
Build tool        → Vite con code splitting manual
Deploy            → Vercel CI/CD
```

-----

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── storefront/       ← Catálogo, carrito, checkout
│   ├── portal/           ← Dashboard del cliente
│   ├── admin/            ← ERP/CRM backoffice
│   └── angela/           ← Asistente IA
├── hooks/                ← Custom hooks con TanStack Query
├── lib/
│   └── supabase.ts       ← Cliente y helpers de Supabase
├── stores/               ← Zustand stores
├── types/                ← Types de TypeScript
└── utils/                ← Utilidades y calculadoras
```

-----

## ⚡ Instalación y uso

```bash
# 1. Clonar el repositorio
git clone https://github.com/Ldeath0/manojitos-bloom.git
cd manojitos-bloom

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Añade tus credenciales de Supabase

# 4. Correr en desarrollo
npm run dev

# 5. Build para producción
npm run build
```

### Variables de entorno requeridas

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

-----

## 🎯 Decisiones técnicas destacadas

**¿Por qué TanStack Query?**
Manejo del estado del servidor con caching inteligente, sincronización automática y optimistic updates — esencial para un e-commerce con datos en tiempo real.

**¿Por qué Supabase?**
PostgreSQL completo + Auth con RLS + Realtime en un solo servicio. Permite escalar sin cambiar el stack y garantiza seguridad a nivel de base de datos.

**¿Por qué Zustand para el carrito?**
Estado persistente ligero sin el boilerplate de Redux. El carrito sobrevive recargas y se sincroniza con la sesión del usuario autenticado.

-----

## 👨‍💻 Autor

**Michael Noriega**
Full-Stack Developer — React · TypeScript · Supabase

- 🌐 [quorex.vercel.app](https://quorex.vercel.app)
- 💼 [github.com/Ldeath0](https://github.com/Ldeath0)
- ✉️ michael.rafael03@gmail.com

-----

<div align="center">
  Construido con ♥ y mucho café — Venezuela 🇻🇪
</div>
