# Enfoque Prestamos

## Objetivo

Convertir la app en una solución sencilla para controlar préstamos rápidos sin exceso de formalidad, enfocada en orden operativo y seguimiento diario.

## Necesidad base

La app debe permitir registrar y controlar:

- Cliente
- Datos del cliente: nombre, cédula/ID opcional, teléfono, dirección, referencia/notas
- Valor prestado
- Interés normal
- Número de cuotas
- Plazo / frecuencia de pago
- Interés por mora
- Estado del préstamo
- Pagos recibidos
- Cuotas pendientes, vencidas y pagadas
- Observaciones y acuerdos informales

## Módulos actuales revisados

### Conviene conservar / reutilizar

- **Auth**: útil para ingreso con usuario y mantener seguridad básica.
- **Dashboard**: conviene rehacerlo como resumen de préstamos: capital prestado, saldo pendiente, cuotas vencidas, mora, préstamos activos.
- **Currencies**: útil si luego se prestan montos en varias monedas; por ahora puede quedarse como soporte.
- **Files**: útil para adjuntar soporte de cliente, recibos o comprobantes.
- **Notifications**: puede servir después para recordar cuotas vencidas o próximas; por ahora no será menú principal.
- **Settings**: útil para configuración general, aunque debe simplificarse.

### Conviene reutilizar parcialmente

- **Credit Cards / Tarjetas**: tiene conceptos cercanos a préstamos: deuda, cuotas, pagos, vencimientos e intereses. Es el módulo más parecido para tomar patrones de UI/API.

### Conviene deshabilitar por ahora

- **Gastos**: no corresponde al flujo principal.
- **Ahorros**: no corresponde al flujo principal.
- **Reportes**: se rehace después con reportes de cartera/préstamos.
- **Tarjetas**: oculto por ahora; sirve como referencia técnica, no como módulo visible.
- **Notificaciones**: oculto del menú mientras se define el flujo de mora/cuotas.

## Propuesta de módulos nuevos

### 1. Clientes

Campos sugeridos:

- nombre
- documento opcional
- teléfono
- dirección
- ciudad/barrio opcional
- referencia opcional
- notas
- estado: activo/inactivo/bloqueado

### 2. Préstamos

Campos sugeridos:

- cliente_id
- monto_principal
- moneda_id
- tasa_interes
- tipo_interes: fijo / mensual / por cuota
- numero_cuotas
- frecuencia: diaria / semanal / quincenal / mensual
- fecha_inicio
- fecha_primer_pago
- interes_mora
- estado: activo / pagado / vencido / cancelado
- notas

### 3. Cuotas

Campos sugeridos:

- prestamo_id
- numero_cuota
- fecha_vencimiento
- capital
- interes
- mora
- total
- pagado
- estado: pendiente / parcial / pagada / vencida

### 4. Pagos

Campos sugeridos:

- prestamo_id
- cuota_id opcional
- fecha_pago
- monto
- método: efectivo / transferencia / otro
- notas

## Primer alcance recomendado

Para una primera versión simple:

1. Renombrar la marca del proyecto a Prestamos.
2. Dejar menú visible solo con:
   - Dashboard
   - Préstamos
   - Configuración
3. Crear pantalla inicial de Préstamos con el enfoque y campos a implementar.
4. En una segunda iteración, crear tablas/API/pantalla CRUD real para clientes, préstamos, cuotas y pagos.

## Módulos deshabilitados en frontend

Los módulos antiguos no se borran del código todavía. Se ocultan de navegación/rutas para no perder trabajo útil mientras se migra:

- `/gastos`
- `/ahorros`
- `/tarjetas`
- `/reportes`
- `/notificaciones`

Esos paths deben redirigir a `/prestamos` mientras se implementa el nuevo flujo.
