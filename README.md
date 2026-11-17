# F2B · Front2Back

Aplicación web para la gestión, trazabilidad y consulta de escalamientos operativos entre Frontoffice y Backoffice.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth + RLS).

## Módulos

| Módulo | Ruta | Descripción |
| --- | --- | --- |
| Frontoffice | `/escalamiento` | Formulario dinámico por tipología. Genera el radicado `ESC-AÑO-0001` y registra el primer movimiento. |
| Backoffice | `/backoffice` | Bandeja protegida con filtros, búsqueda, detalle del caso, actualización de estado/paso/responsable e historial automático. |
| Consulta | `/consulta` | Buscador público por radicado con estado, línea de tiempo y observaciones de resolución. |
| Acceso | `/login` | Autenticación con Supabase Auth para agentes y analistas de Backoffice. |

## Plantillas incluidas

El formulario de escalamiento incluye las 14 plantillas de Back Office, agrupadas por categoría y con su nota operativa:

| Categoría | Plantillas |
| --- | --- |
| Calidad | Escucha de llamada |
| Tarifas | Tarifa especial por tarifa nueva comercial |
| Televisor | Desbloqueo de Televisor |
| Visita técnica | Visita técnica · Creación de visita error T&D |
| Alarmas | Alarma puntual · Revista 15 min no llega |
| Aplicaciones | Requerimiento Mi Asistencia 360 (OTTs / Claro Drive) · McAfee |
| Pagos | Pagos no aplicados |
| Cartera | Escalamiento Cartera |
| PQR | Materialización PQR |
| Logística equipos | Modificación envío equipo · Eliminación plan de pagos Ascard |

Cada plantilla genera una vista previa en texto lista para copiar y pegar en F7 o Genesys, además de quedar registrada en el caso para su consulta y trazabilidad.

## Estructura del proyecto

```text
.
├── app/
│   ├── page.tsx                     # Inicio
│   ├── layout.tsx
│   ├── globals.css
│   ├── login/
│   │   ├── page.tsx
│   │   └── actions.ts               # login / logout
│   ├── escalamiento/
│   │   ├── page.tsx                 # Módulo A
│   │   └── actions.ts               # crearCaso + validación
│   ├── backoffice/
│   │   ├── layout.tsx               # Protección por rol
│   │   ├── page.tsx                 # Bandeja
│   │   ├── actions.ts               # actualizarCaso
│   │   └── [id]/page.tsx            # Detalle + historial
│   └── consulta/
│       └── page.tsx                 # Módulo C
├── components/                      # UI reutilizable
├── lib/
│   ├── auth.ts
│   ├── plantillas.ts                # Tipologías y campos dinámicos
│   ├── supabase/
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── types.ts
│   └── utils.ts
├── middleware.ts                    # Refresco de sesión + rutas protegidas
├── schema.sql                       # Esquema completo para Supabase
├── .env.example
└── README.md
```

## Requisitos

- Node.js 20 o superior.
- Cuenta y proyecto en [Supabase](https://supabase.com).

## 1. Clonar e instalar

```bash
git clone <URL_DEL_REPOSITORIO>
cd FRONT2BACK
npm install
```

## 2. Configurar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta completo el archivo [`schema.sql`](./schema.sql).
   - Crea tipos, tablas, índices, triggers, funciones RPC y políticas RLS.
   - La generación del radicado es atómica y consecutiva por año.
3. En **Authentication → Users**, crea los usuarios con correo y contraseña.
   - El trigger `handle_new_user` crea automáticamente el perfil en `public.usuarios` con rol `agente`.
   - Usa el campo de metadata `nombre_completo` al crear el usuario para asignar el nombre visible.
4. Promueve a los analistas de Backoffice:

```sql
update public.usuarios
set rol = 'backoffice'
where correo = 'analista@empresa.com';
```

5. Recomendado: en **Authentication → Providers → Email**, desactiva el registro público (*Allow new users to sign up*) y crea las cuentas desde el panel de administración.

### Roles

- `agente`: puede radicar escalamientos y ver sus propios casos.
- `backoffice`: puede ver y gestionar todos los casos, asignarlos y registrar movimientos.

## 3. Variables de entorno

Copia el archivo de ejemplo y completa los valores del proyecto Supabase (**Project Settings → API**):

```bash
cp .env.example .env.local
```

Para despliegue con Docker, usa `.env.production` (no se versiona):

```bash
cp .env.production.example .env.production
```

Puedes usar la **anon key** clásica o la nueva **publishable key** de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# o NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
```

También se admite el formato anterior:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-publica
```

No se requiere `service_role` en el frontend. Todas las operaciones sensibles se ejecutan con las políticas RLS y funciones `security definer` controladas.

## 4. Ejecutar localmente

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## 5. Verificación y producción

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

## 6. Despliegue con Docker en un servidor

Requisitos en el servidor: Docker y Docker Compose, y acceso Git al repositorio.

```bash
git clone https://github.com/lexnardos/Front2Back.git
cd Front2Back
cp .env.production.example .env.production
# edita .env.production con la URL y la publishable key de Supabase
docker compose up -d --build
```

La aplicación queda disponible en `http://IP-DEL-SERVIDOR:3000`. Para actualizar tras un `git push`:

```bash
git pull
docker compose up -d --build
```

Si publicas detrás de un proxy inverso (Nginx/Caddy) con HTTPS, registra ese dominio como `Site URL` en Supabase (**Authentication → URL Configuration**).

## 7. Publicar en GitHub y desplegar en la web

El repositorio no incluye `.env.local`; las credenciales se configuran aparte en cada entorno.

```bash
git init
git add .
git commit -m "F2B: aplicacion de escalamientos Frontoffice-Backoffice"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

Con GitHub CLI puedes crear el repositorio y subirlo en un paso:

```bash
gh repo create front2back --private --source=. --remote=origin --push
```

Luego despliega en [Vercel](https://vercel.com/new) importando el repositorio:

1. Framework: **Next.js** (se detecta automáticamente).
2. Agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en **Environment Variables** para Production, Preview y Development.
3. Deploy.
4. En Supabase ve a **Authentication → URL Configuration** y define el dominio de Vercel como `Site URL`, agregando `https://tu-dominio.vercel.app/**` y `http://localhost:3000/**` en `Redirect URLs`.

Cada `git push` a `main` genera un nuevo despliegue automático en Vercel.

## Seguridad y trazabilidad

- Las rutas `/escalamiento` y `/backoffice` están protegidas por middleware y validación de sesión/rol en servidor.
- RLS limita la lectura a los casos propios, asignados o de Backoffice.
- El radicado se asigna en un trigger con bloqueo atómico (`INSERT ... ON CONFLICT DO UPDATE`), evitando duplicados.
- Cada creación o actualización registra un movimiento en `historial_movimientos` dentro de la misma función RPC.
- La consulta pública usa `consultar_radicado`, una función `security definer` que devuelve estado, fechas e historial, sin exponer la plantilla completa ni correos.
- Los comentarios del historial son visibles en la consulta pública. Evita incluir datos personales sensibles o credenciales en ellos.

## Funciones RPC principales

| Función | Uso |
| --- | --- |
| `crear_caso_escalamiento(...)` | Inserta el caso, genera el radicado y registra el movimiento inicial. |
| `actualizar_caso_escalamiento(...)` | Actualiza estado, paso, responsable y agrega el movimiento al historial. |
| `consultar_radicado(p_radicado)` | Consulta pública segura por radicado. |
| `es_backoffice()` / `puede_ver_caso(id)` | Helpers de autorización usados por las políticas RLS. |

## Solución de problemas

- **“Tu usuario no tiene perfil en F2B”**: el usuario existe en Auth pero no en `public.usuarios`. Puedes crear los perfiles faltantes con:

```sql
insert into public.usuarios (id, nombre_completo, correo, rol)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data ->> 'nombre_completo'), ''), split_part(email, '@', 1)),
  email,
  'agente'
from auth.users
on conflict (id) do nothing;
```

- **Un agente recibe “Solo los usuarios de Backoffice…”**: actualiza su `rol` en `public.usuarios`.
- **No se genera el radicado**: confirma que ejecutaste el `schema.sql` completo, incluidos el trigger `trg_casos_numero_radicado` y la tabla `secuencias_radicado`.
- **Error de conexión**: revisa que `.env.local` tenga la URL y una de las dos claves (anon o publishable), y reinicia `npm run dev`.
