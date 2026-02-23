# ALICE FIX Gateway

FIX protocol gateway for electronic trading — message routing, protocol validation, and session management.

**License: AGPL-3.0**

---

## Architecture

```
                    ┌─────────────────┐
                    │   Browser / UI  │
                    │  Next.js :3000  │
                    └────────┬────────┘
                             │ HTTP
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │     :8080       │
                    └────────┬────────┘
                             │ HTTP
                    ┌────────▼────────┐
                    │   FIX Engine    │
                    │  Rust/Axum      │
                    │    :8081        │
                    └─────────────────┘
```

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js dashboard |
| API Gateway | 8080 | Reverse proxy / auth |
| FIX Engine | 8081 | Rust/Axum core engine |

---

## API Endpoints

### POST /api/v1/fix/send

Send a FIX message with automatic sequence numbering.

**Request:**
```json
{
  "msg_type": "NewOrderSingle",
  "fields": {
    "BeginString": "FIX.4.4",
    "SenderCompID": "ALICE",
    "TargetCompID": "BROKER",
    "ClOrdID": "ORD001",
    "Symbol": "AAPL",
    "Side": "1",
    "OrderQty": "100",
    "OrdType": "2",
    "Price": "150.00"
  }
}
```

**Response:**
```json
{
  "session_id": "ALICE->BROKER",
  "msg_type": "NewOrderSingle",
  "sequence_number": 1,
  "fix_message": "8=FIX.4.4\u000135=D\u000149=ALICE\u000156=BROKER\u000134=1\u000152=20260223-00:00:00.000\u0001...\u000110=000\u0001",
  "fields": { "...": "..." },
  "sent_at_ms": 1740268800000
}
```

---

### POST /api/v1/fix/parse

Parse a raw FIX wire message into structured fields.

**Request:**
```json
{
  "raw_message": "8=FIX.4.4|9=120|35=D|49=ALICE|56=BROKER|34=1|52=20260223-00:00:00.000|11=ORD001|55=AAPL|54=1|38=100|40=2|44=150.00|10=000|"
}
```

Use `|` or SOH (`\x01`) as field delimiter.

**Response:**
```json
{
  "msg_type": "NewOrderSingle",
  "fields": [
    { "tag": 8, "name": "BeginString", "value": "FIX.4.4" },
    { "tag": 35, "name": "MsgType", "value": "D" },
    { "tag": 49, "name": "SenderCompID", "value": "ALICE" }
  ],
  "field_count": 14,
  "raw_length": 121
}
```

---

### GET /api/v1/fix/sessions

List all active FIX sessions.

**Response:**
```json
{
  "sessions": [
    {
      "session_id": "ALICE->BROKER_A",
      "sender_comp_id": "ALICE",
      "target_comp_id": "BROKER_A",
      "fix_version": "FIX.4.4",
      "state": "ACTIVE",
      "msg_seq_num": 1,
      "connected_at": 1740268800
    }
  ],
  "count": 2
}
```

Session states: `ACTIVE` | `LOGON_SENT` | `LOGOUT_SENT` | `DISCONNECTED`

---

### POST /api/v1/fix/validate

Validate a FIX message map against required field rules.

**Request:**
```json
{
  "message": {
    "BeginString": "FIX.4.4",
    "BodyLength": "120",
    "MsgType": "D",
    "SenderCompID": "ALICE",
    "TargetCompID": "BROKER",
    "MsgSeqNum": "1",
    "SendingTime": "20260223-00:00:00.000",
    "ClOrdID": "ORD001",
    "Symbol": "AAPL",
    "Side": "1",
    "OrderQty": "100"
  },
  "version": "FIX.4.4"
}
```

**Response (valid):**
```json
{
  "valid": true,
  "version": "FIX.4.4",
  "msg_type": "D",
  "errors": []
}
```

**Response (invalid):**
```json
{
  "valid": false,
  "version": "FIX.4.4",
  "msg_type": "D",
  "errors": [
    {
      "field": "ClOrdID",
      "tag": 11,
      "message": "NewOrderSingle requires ClOrdID (tag 11)."
    }
  ]
}
```

---

### GET /health

```json
{
  "status": "ok",
  "uptime_secs": 3600,
  "service": "alice-fix-engine",
  "version": "1.0.0"
}
```

---

## Quick Start

### FIX Engine (Rust)

```bash
cd services/core-engine
cargo build --release
FIX_ADDR=0.0.0.0:8081 ./target/release/fix-engine
```

### Frontend (Next.js)

```bash
cd frontend
npm install
NEXT_PUBLIC_FIX_API_URL=http://localhost:8081 npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FIX_ADDR` | `0.0.0.0:8081` | FIX engine bind address |
| `NEXT_PUBLIC_FIX_API_URL` | `http://localhost:8081` | API base URL for frontend |

---

## Supported FIX Versions

| Version | Description |
|---------|-------------|
| FIX 4.2 | Legacy equities |
| FIX 4.4 | Standard equities / derivatives |
| FIX 5.0 | Modern multi-asset |

---

## Supported Message Types

| MsgType | Code | Description |
|---------|------|-------------|
| NewOrderSingle | D | Submit new order |
| ExecutionReport | 8 | Order status / fill |
| OrderCancelRequest | F | Cancel existing order |
| MarketDataRequest | V | Subscribe to market data |
| Heartbeat | 0 | Session keep-alive |
| Logon | A | Session initiation |
| Logout | 5 | Session termination |

---

## Required Fields by Message Type

### NewOrderSingle (D)

| Tag | Field | Required |
|-----|-------|---------|
| 8 | BeginString | Yes |
| 9 | BodyLength | Yes |
| 35 | MsgType | Yes |
| 49 | SenderCompID | Yes |
| 56 | TargetCompID | Yes |
| 34 | MsgSeqNum | Yes |
| 52 | SendingTime | Yes |
| 11 | ClOrdID | Yes |
| 55 | Symbol | Yes |
| 54 | Side | Yes |
| 38 | OrderQty | Yes |

### OrderCancelRequest (F)

| Tag | Field | Required |
|-----|-------|---------|
| 11 | ClOrdID | Yes |
| 55 | Symbol | Yes |

---

## License

AGPL-3.0 — See [LICENSE](LICENSE) for details.
