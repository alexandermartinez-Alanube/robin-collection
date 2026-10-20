# CONTEXTO DE NEGOCIO: ALANUBE COLLECTION

## 1. TIPOS DE FACTURACIÓN Y PRODUCTOS
Alanube gestiona cobros bajo las siguientes modalidades de contrato:
- **API Mensual:** Recurrencia de cobro mes a mes según consumo o plan contratado.
- **API Anual:** Cobro único o diferido con vigencia de 12 meses.
- **Certificados como Emisor Electrónico (OTP):** Facturación por emisión y validación de tokens/OTP.
- **Certificados de Firma Electrónica:** Cobro por expedición, renovación o uso de firmas digitales.

## 2. PARÁMETROS TEMPORALES Y REGLAS DE COBRO
- **Fecha de Emisión:** Marca el inicio del ciclo de cobro y generación de comprobantes.
- **Fecha de Vencimiento:** Límite para la recepción del pago sin penalizaciones.
- **Estado de Cuenta:** 
  - *Al día:* Pago realizado antes o en la fecha de vencimiento.
  - *Próximo a vencer:* Faltan entre 1 y 5 días para el vencimiento.
  - *En Mora:* Excedida la fecha de vencimiento.

## 3. PENALIZACIONES Y EXCEPCIONES
- **Recargos por Mora:** Se calculan a partir del primer día hábil posterior al vencimiento según las condiciones específicas de la sociedad/contrato.
- **Intereses de Mora:** Aplicación de porcentaje de interés sobre el saldo vencido (definido en las cláusulas contractuales del cliente).
- **Excepciones de Contrato:** Prevalecen sobre las reglas generales solo si están explícitamente documentadas en la ficha del cliente.