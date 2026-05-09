# Natillera

Aplicación web para administrar una natillera familiar con modo público y modo administrador.

## Qué incluye

- Configuración de la natillera: nombre, fechas, duración, fecha estimada de liquidación y estado.
- Participantes: registro, edición, activación/desactivación y ficha individual.
- Caja general: cálculo automático de entradas, salidas, fondo común y movimientos.
- Aportes mensuales: cuotas variables por participante, pagos parciales y mora del 2%.
- Polla mensual: aporte fijo de `5000`, número por mes, ganador y reparto 50/50.
- Almuerzos: aporte fijo de `5000` por participante cada mes.
- Préstamos: desembolso desde caja, tabla de amortización e interés mensual del 5%.
- Liquidación final: ahorro individual + fondo común - deudas pendientes.
- Alertas administrativas: vencidos, pendientes, deudas y proximidad de liquidación.
- Vista pública: consulta de caja y buscador por participante sin permisos de edición.

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS 4
- Persistencia local en JSON (`data/natillera.json`)
- Persistencia en producción con Upstash Redis en Vercel

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Crea tu archivo de entorno:

```bash
cp .env.example .env.local
```

3. Configura las variables:

```env
NATILLERA_ADMIN_USERNAME=admin
NATILLERA_ADMIN_PASSWORD=Familia123
NATILLERA_SESSION_SECRET=un-secreto-largo-y-aleatorio
```

Para producción en Vercel, instala **Upstash Redis** desde Vercel Marketplace. Esa integración agrega automáticamente:

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Opcionalmente puedes definir una clave propia para guardar los datos:

```env
NATILLERA_REDIS_DATA_KEY=natillera:database
```

Si no configuras variables de entorno en desarrollo, la app usa un fallback local:

- Usuario: `admin`
- Contraseña: `Familia123`

Ese fallback es solo para desarrollo y debe cambiarse antes de usar la app en un entorno real.

## Ejecutar

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Cómo probar

- Vista pública: entra a `/`
- Login admin: entra a `/login`
- Panel admin: entra a `/admin`

Flujos recomendados:

1. Configura fechas y estado en `Configuración`.
2. Registra participantes en `Participantes`.
3. Carga aportes en `Aportes`.
4. Registra polla y ganador mensual en `Polla`.
5. Registra almuerzos en `Almuerzos`.
6. Crea préstamos y abona cuotas en `Préstamos`.
7. Revisa caja y movimientos en `Caja`.
8. Genera la proyección final en `Liquidación`.

## Persistencia

En desarrollo, los datos se guardan en:

```text
data/natillera.json
```

La app crea ese archivo automáticamente si no existe.

En Vercel, el sistema de archivos del despliegue es de solo lectura, así que las ediciones se guardan en Upstash Redis. Si la clave de Redis está vacía, la app toma como semilla el contenido de `data/natillera.json` del despliegue actual.

## Validaciones principales

- No permite préstamos mayores que la caja disponible.
- No permite duplicar aporte, polla o almuerzo del mismo participante en el mismo mes y año.
- No permite valores negativos.
- No permite pagar más que el saldo pendiente de una cuota de préstamo.
- Protege rutas administrativas con cookie de sesión y verificación del lado del servidor.

## Calidad

Validado con:

```bash
npm run lint
npm run build
```
