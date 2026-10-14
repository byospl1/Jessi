# Piloto de progresión supervisada — propuesta

Estado: la captura y el generador de borradores adaptativos están implementados. La semana del 12–18 de octubre de 2026 se actualizó con el método anterior por instrucción de Hugo. El piloto de cuatro semanas, del 19 de octubre al 15 de noviembre, mantiene la aprobación humana obligatoria antes de cada cambio de rutina. El generador diario solo escribe un borrador; nunca modifica ejercicios ni cargas.

## Base y alcance

Usar una regla transparente inspirada en los principios públicos de RP: desempeño, repeticiones en reserva, recuperación, dificultad y feedback de entrenamiento. La investigación anterior no encontró el código propietario exacto de RP; los umbrales siguientes son decisiones de nuestro piloto y se ajustarán juntos.

RP explica públicamente que puede aumentar carga o repeticiones y ajustar series con el feedback: [Hypertrophy App Progressions](https://help.rpstrength.com/hc/en-us/articles/32600173777815-Hypertrophy-App-Progressions), [Progressing for Hypertrophy](https://rpstrength.com/blogs/articles/progressing-for-hypertrophy). La autorregulación usa desempeño y capacidad percibida como insumos: [Greig et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7575491/). Esto justifica el enfoque; no valida una fórmula específica para Jessi.

## Feedback necesario

Jessi, después de cada ejercicio: peso y repeticiones realmente realizados por serie, KG/LB, cuántas repeticiones completas cree que le quedaban (RIR), dificultad, molestias articulares y comentario opcional. Antes de repetir el grupo muscular: recuperación y agujetas que limiten movimiento. Bombeo se registra como contexto, sin asumir que más bombeo equivale a más progreso.

Hugo: técnica aceptable o pendiente de revisión, rango de repeticiones y RIR objetivo por ejercicio, incremento de carga disponible, limitaciones vigentes y decisión de mantener/progresar/descargar. Una indicación concreta de Hugo tiene prioridad sobre la regla general.

Los datos de Jessi se capturan en la app por ejercicio y se conservan separados de los objetivos de la siguiente semana. Guardar una carga objetivo o marcar un día manualmente no basta para afirmar que se completó una serie. La revisión del asesor se registra al aprobar o rechazar un borrador mediante GitHub Actions; todavía no hay una interfaz privada de asesor.

## Modelo implementado (`reviewed-rp-v1`)

Cada mañana el workflow lee las rutinas vigentes y el progreso de la semana actual y anterior. Guarda en `progreso/{semana_siguiente}.adaptiveDraft` una propuesta con evidencia, motivo y faltantes por ejercicio; si el input no cambió, no reescribe. No usa modelos de IA ni atribuye eficacia a la fórmula propietaria de RP.

Para proponer un aumento exige: día cerrado, todas las series marcadas, carga/unidad/repeticiones reales completas y comparables con el objetivo, objetivo de repeticiones alcanzado, RIR al menos 2, dificultad no «muy difícil», recuperación «buena», sin molestia articular ni agujetas limitantes y sin pausas/descarga. Bombeo y comentario quedan como contexto. Si algo falta o es dudoso, mantiene el objetivo y señala la causa. El rango inicial es 8–12, salvo `progressionConfig.minReps/maxReps` por ejercicio.

Si alguna serie objetivo está por debajo del máximo, propone +1 repetición en esas series sin cambiar peso ni volumen. Si todas están en el máximo, requiere dos exposiciones semanales comparables y un `progressionConfig.loadStep` y `loadStepUnit` aprobados; solo propone subir carga si el salto es positivo y no supera el 5% de cada carga, reiniciando al mínimo del rango. Sin salto configurado, pide revisión. No propone cambios de volumen ni descargas automáticas.

La aprobación exige elegir IDs de ejercicios concretos y confirmar revisión de técnica. Antes de escribir, recalcula el borrador con Firestore, comprueba que la rutina no cambió, que la semana origen terminó o que todos los días están cerrados y que la semana destino no empezó. Aplica todos los cambios aprobados y el registro de decisión en un único commit condicional, luego verifica. Rechazar solo registra la decisión. La antigua acción de incremento quedó en modo simulación.

## Reglas iniciales para depurar juntos

| Condición | Propuesta |
| --- | --- |
| Falta feedback, faltan registros de ejecución, hay unidades dudosas o técnica sin revisar | Mantener y señalar exactamente qué falta. |
| Hay una pausa indicada por Hugo o molestias que requieren revisión | Bloquear aumentos; presentar el ejercicio para revisión. |
| Se completan los objetivos con técnica aceptable, recuperación adecuada y RIR dentro del objetivo, sin alcanzar todavía el máximo del rango | Proponer +1 repetición en las series que cumplan, manteniendo peso y series. |
| Se alcanza el máximo del rango durante dos exposiciones comparables, con técnica y recuperación adecuadas | Proponer el menor incremento disponible de carga y volver al mínimo del rango aprobado. |
| El siguiente salto de carga es demasiado grande | Mantener el peso y ajustar repeticiones dentro del rango aprobado. |
| La recuperación es insuficiente, cae el desempeño o se incumple el RIR objetivo | Proponer mantener o descargar; el ajuste concreto requiere revisión de Hugo. |
| Se valora aumentar o reducir series | Presentar una decisión separada por grupo muscular; no subir simultáneamente carga, repeticiones y series por defecto. |

Rango de partida sugerido para explorar: 8–12 repeticiones y aproximadamente 2 RIR, sujeto a la prescripción de Hugo para cada ejercicio; los ejercicios con otra prescripción conservan su rango. Un salto inicial de carga de 2–5% es una configuración candidata, no una constante oficial de RP. Se ajusta a discos/máquinas reales y a la técnica, y no convierte automáticamente KG en LB.

## Ciclo semanal de aprobación

1. Cerrar los datos de la semana y registrar el feedback de ambos.
2. Presentar una tabla por ejercicio: carga/repeticiones actuales, ejecución comprobada, RIR/recuperación/técnica, propuesta, motivo y datos faltantes.
3. Hugo aprueba, modifica o rechaza cambios concretos. Sin respuesta, mantener la rutina.
4. Releer Firebase antes de aplicar: si cambió una rutina o comenzó la nueva sesión, revisar de nuevo. Guardar versión anterior, decisión, valores finales y fecha de aprobación.
5. Aplicar una sola vez y verificar que la página publique esos valores, conservando el historial realizado.

## Las cuatro semanas

| Semana | Objetivo |
| --- | --- |
| 19–25 oct | Calibrar RIR, técnica, unidades y equipo; priorizar propuestas pequeñas con datos suficientes. |
| 26 oct–1 nov | Contrastar propuestas con ejecución y feedback; corregir los primeros falsos aumentos o mantenimientos. |
| 2–8 nov | Ajustar por ejercicio los umbrales y las prioridades que hayan demostrado problemas. |
| 9–15 nov | Evaluar tolerancia, desempeño, adherencia y correcciones; decidir si mantener el modelo, extender el piloto o descargar. |

No programar acercamiento obligatorio al fallo ni descarga por calendario sin la revisión de Hugo. La semana cuatro puede ser una descarga si el desempeño y la recuperación lo justifican.

## Evaluación y mejoras pendientes

Registrar cuántas propuestas aceptó/corrigió/rechazó Hugo, motivo de cada corrección, sesiones con datos suficientes, cumplimiento de los rangos y RIR, recuperación y tolerancia a los incrementos. El piloto mide si la herramienta ayuda a decidir; no permite atribuir cambios físicos al algoritmo en un mes.

El feedback de la alumna y las decisiones del asesor se guardan separados; el borrador se vincula mediante huella y versiones exactas de rutina. Sigue pendiente una interfaz privada de asesor con autenticación, configuración de incrementos reales por máquina y validación clínica/técnica del piloto. No añadir un botón público de aprobación mientras Firebase permita lectura/escritura anónima.
