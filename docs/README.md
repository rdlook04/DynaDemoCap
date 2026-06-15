# DynaDemoCap — Documentación del Arnés (Harness-SDD)

Este directorio (`docs/`) contiene documentación de soporte del proyecto.
Las **especificaciones formales** que gobiernan la implementación viven en `specs/`:

| Artefacto | Archivo | Propósito |
|-----------|---------|-----------|
| Requisitos | [`specs/requirements.md`](../specs/requirements.md) | Requisitos funcionales en notación EARS |
| Diseño | [`specs/design.md`](../specs/design.md) | Decisiones técnicas y arquitectura |
| Tareas | [`specs/tasks.md`](../specs/tasks.md) | Checklist atómico de implementación |

## Flujo SDD (Spec-Driven Development)

```
[Spec-Author] → requirements.md → design.md → tasks.md
        │
        ▼
[Puerta de Aprobación Humana]  ◀── ESTAMOS AQUÍ (spec_pending_approval)
        │
        ▼ (spec_ready)
[Builder] → Implementación de código según tasks.md
```

> ⚠️ Ningún código funcional debe escribirse hasta obtener la aprobación explícita (`spec_ready`).

## Feature activa

- **`f1_exchange_simulator`** — estado: `pending` (ver `feature_list.json`).
