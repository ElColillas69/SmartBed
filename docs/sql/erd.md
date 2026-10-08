
PostgreSQL

```mermaid
erDiagram
    USERS ||--o{ BEDS : "owns"
    BEDS ||--o{ DEVICES : "has fitted"
    MEASUREMENT_TYPES ||--o{ DEVICES : "describes"
    DEVICES ||--o{ READINGS : "reports"

    USERS {
        SERIAL user_id PK
        VARCHAR email UK "login, unique"
        VARCHAR password_hash "hashed, never plain"
        VARCHAR display_name
        TIMESTAMPTZ created_at
    }
    BEDS {
        SERIAL bed_id PK
        INT user_id FK
        VARCHAR name
        TIMESTAMPTZ created_at
    }
    MEASUREMENT_TYPES {
        SERIAL measurement_type_id PK
        VARCHAR name UK "weight, temperature..."
        VARCHAR unit "kg, C, %, lux"
        VARCHAR value_kind "number or on_off"
    }
    DEVICES {
        SERIAL device_id PK
        INT bed_id FK
        INT measurement_type_id FK
        VARCHAR label
        BOOLEAN is_active
        TIMESTAMPTZ installed_at
    }
    READINGS {
        BIGSERIAL reading_id PK
        INT device_id FK
        NUMERIC value
        TIMESTAMPTZ recorded_at
    }
```

PK = primary key · FK = foreign key · UK = unique. Every relationship is one-to-many (one on the left, zero or more on the right).

## Relationships

- One **user** owns zero or more **beds**.
- One **bed** has zero or more **devices** fitted to it.
- One **measurement type** describes zero or more **devices** (e.g. every temperature sensor points to the "temperature" type).
- One **device** reports zero or more **readings** over time.
