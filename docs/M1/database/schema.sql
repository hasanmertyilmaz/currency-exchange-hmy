-- Kantor Mobile — conceptual database schema (M1 design draft)
-- Target: PostgreSQL 16. In M2 this file becomes the first Flyway migration
-- (backend/src/main/resources/db/migration/V1__init.sql). Not yet executed.

CREATE TABLE app_user (
    id             UUID         PRIMARY KEY,
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,           -- BCrypt hash, never the password
    display_name   VARCHAR(80)  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_email UNIQUE (email)     -- e-mail stored lower-cased
);

CREATE TABLE currency (
    code       CHAR(3)     PRIMARY KEY,             -- ISO 4217, e.g. PLN, EUR
    name       VARCHAR(64) NOT NULL,
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO currency (code, name) VALUES
    ('PLN', 'Polish zloty'),
    ('USD', 'US dollar'),
    ('EUR', 'Euro'),
    ('GBP', 'Pound sterling'),
    ('CHF', 'Swiss franc');

CREATE TABLE wallet (
    id             UUID          PRIMARY KEY,
    user_id        UUID          NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    currency_code  CHAR(3)       NOT NULL REFERENCES currency (code),
    balance        NUMERIC(19,4) NOT NULL DEFAULT 0,
    version        BIGINT        NOT NULL DEFAULT 0,  -- incremented on every change
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_wallet_user_currency UNIQUE (user_id, currency_code),
    CONSTRAINT ck_wallet_balance_non_negative CHECK (balance >= 0)
);

CREATE TABLE exchange_rate (
    id              BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    currency_code   CHAR(3)       NOT NULL REFERENCES currency (code),
    table_no        VARCHAR(32)   NOT NULL,          -- e.g. '212/C/NBP/2026'
    effective_date  DATE          NOT NULL,
    bid             NUMERIC(12,6) NOT NULL,          -- NBP buys foreign currency (user sells)
    ask             NUMERIC(12,6) NOT NULL,          -- NBP sells foreign currency (user buys)
    fetched_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_exchange_rate_currency_date UNIQUE (currency_code, effective_date),
    CONSTRAINT ck_exchange_rate_positive CHECK (bid > 0 AND ask > 0 AND ask >= bid)
);

CREATE TABLE exchange_transaction (
    id             UUID          PRIMARY KEY,
    user_id        UUID          NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    operation_id   UUID          NOT NULL,           -- client-generated stable identity
    type           VARCHAR(10)   NOT NULL,
    from_currency  CHAR(3)       REFERENCES currency (code),
    from_amount    NUMERIC(19,4),
    to_currency    CHAR(3)       NOT NULL REFERENCES currency (code),
    to_amount      NUMERIC(19,4) NOT NULL,
    rate           NUMERIC(12,6),
    rate_id        BIGINT        REFERENCES exchange_rate (id),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_exchange_transaction_operation UNIQUE (user_id, operation_id),
    CONSTRAINT ck_exchange_transaction_type CHECK (type IN ('DEPOSIT', 'BUY', 'SELL')),
    CONSTRAINT ck_exchange_transaction_amounts CHECK (
        to_amount > 0 AND (from_amount IS NULL OR from_amount > 0)
    ),
    CONSTRAINT ck_exchange_transaction_shape CHECK (
        (type = 'DEPOSIT' AND from_currency IS NULL AND from_amount IS NULL
                          AND rate IS NULL AND rate_id IS NULL AND to_currency = 'PLN')
     OR (type = 'BUY'  AND from_currency = 'PLN' AND to_currency <> 'PLN'
                       AND from_amount IS NOT NULL AND rate IS NOT NULL AND rate_id IS NOT NULL)
     OR (type = 'SELL' AND to_currency = 'PLN' AND from_currency <> 'PLN'
                       AND from_amount IS NOT NULL AND rate IS NOT NULL AND rate_id IS NOT NULL)
    )
);

CREATE INDEX ix_exchange_transaction_user_created
    ON exchange_transaction (user_id, created_at DESC);

CREATE TABLE operation_record (
    user_id         UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    operation_id    UUID         NOT NULL,
    operation_type  VARCHAR(10)  NOT NULL,
    request_hash    CHAR(64)     NOT NULL,           -- SHA-256 of canonical request body
    outcome         VARCHAR(10)  NOT NULL,
    http_status     SMALLINT     NOT NULL,
    response_body   JSONB        NOT NULL,           -- replayed verbatim for duplicates
    transaction_id  UUID         REFERENCES exchange_transaction (id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, operation_id),
    CONSTRAINT ck_operation_record_type CHECK (operation_type IN ('DEPOSIT', 'BUY', 'SELL')),
    CONSTRAINT ck_operation_record_outcome CHECK (outcome IN ('COMPLETED', 'REJECTED')),
    CONSTRAINT ck_operation_record_link CHECK (
        (outcome = 'COMPLETED' AND transaction_id IS NOT NULL)
     OR (outcome = 'REJECTED'  AND transaction_id IS NULL)
    )
);

CREATE UNIQUE INDEX uq_operation_record_transaction
    ON operation_record (transaction_id) WHERE transaction_id IS NOT NULL;
