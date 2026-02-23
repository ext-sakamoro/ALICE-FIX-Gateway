use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::Instant,
};
use tracing::info;
use tracing_subscriber::EnvFilter;

// ── AppState ──────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    start_time: Arc<Instant>,
    /// Shared mutable list of active FIX sessions
    sessions: Arc<Mutex<Vec<FixSession>>>,
    /// Monotonic sequence number for outbound messages
    seq_num: Arc<Mutex<u64>>,
}

// ── Domain types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
struct FixSession {
    session_id: String,
    sender_comp_id: String,
    target_comp_id: String,
    fix_version: String,
    state: String,
    msg_seq_num: u64,
    connected_at: u64,
}

// ── Request / Response types ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SendRequest {
    msg_type: String,
    fields: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
struct SentMessage {
    session_id: String,
    msg_type: String,
    sequence_number: u64,
    fix_message: String,
    fields: HashMap<String, String>,
    sent_at_ms: u64,
}

#[derive(Debug, Deserialize)]
struct ParseRequest {
    raw_message: String,
}

#[derive(Debug, Serialize)]
struct ParsedField {
    tag: u32,
    name: String,
    value: String,
}

#[derive(Debug, Serialize)]
struct ParseResponse {
    msg_type: String,
    fields: Vec<ParsedField>,
    field_count: usize,
    raw_length: usize,
}

#[derive(Debug, Serialize)]
struct SessionsResponse {
    sessions: Vec<FixSession>,
    count: usize,
}

#[derive(Debug, Deserialize)]
struct ValidateRequest {
    message: HashMap<String, String>,
    version: String,
}

#[derive(Debug, Serialize)]
struct ValidationError {
    field: String,
    tag: u32,
    message: String,
}

#[derive(Debug, Serialize)]
struct ValidateResponse {
    valid: bool,
    version: String,
    msg_type: String,
    errors: Vec<ValidationError>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    uptime_secs: u64,
    service: String,
    version: String,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let uptime = state.start_time.elapsed().as_secs();
    Json(HealthResponse {
        status: "ok".to_string(),
        uptime_secs: uptime,
        service: "alice-fix-engine".to_string(),
        version: "1.0.0".to_string(),
    })
}

async fn send(
    State(state): State<AppState>,
    Json(req): Json<SendRequest>,
) -> Result<Json<SentMessage>, StatusCode> {
    if req.msg_type.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let seq_num = {
        let mut lock = state.seq_num.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        *lock += 1;
        *lock
    };

    // Build FIX wire message (SOH-delimited)
    let fix_version = req.fields
        .get("BeginString")
        .cloned()
        .unwrap_or_else(|| "FIX.4.4".to_string());

    let sender = req.fields
        .get("SenderCompID")
        .cloned()
        .unwrap_or_else(|| "ALICE".to_string());

    let target = req.fields
        .get("TargetCompID")
        .cloned()
        .unwrap_or_else(|| "BROKER".to_string());

    let msg_type_num = msg_type_to_num(&req.msg_type);
    let now_ms = epoch_ms();

    let fix_message = build_fix_message(
        &fix_version,
        &msg_type_num,
        &sender,
        &target,
        seq_num,
        &req.fields,
    );

    info!(
        msg_type = %req.msg_type,
        sequence_number = seq_num,
        fix_version = %fix_version,
        "FIX message sent"
    );

    Ok(Json(SentMessage {
        session_id: format!("{}->{}", sender, target),
        msg_type: req.msg_type,
        sequence_number: seq_num,
        fix_message,
        fields: req.fields,
        sent_at_ms: now_ms,
    }))
}

async fn parse(
    State(_state): State<AppState>,
    Json(req): Json<ParseRequest>,
) -> Result<Json<ParseResponse>, StatusCode> {
    if req.raw_message.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let raw_length = req.raw_message.len();
    let mut fields: Vec<ParsedField> = Vec::new();
    let mut msg_type = "Unknown".to_string();

    // FIX messages use SOH (0x01) as field delimiter; accept both \x01 and |
    let delimiter = if req.raw_message.contains('\x01') { '\x01' } else { '|' };

    for segment in req.raw_message.split(delimiter) {
        if segment.is_empty() {
            continue;
        }
        if let Some((tag_str, value)) = segment.split_once('=') {
            if let Ok(tag) = tag_str.trim().parse::<u32>() {
                let name = tag_to_name(tag);
                if tag == 35 {
                    msg_type = fix_msg_type_name(value);
                }
                fields.push(ParsedField {
                    tag,
                    name,
                    value: value.to_string(),
                });
            }
        }
    }

    let field_count = fields.len();

    info!(
        msg_type = %msg_type,
        field_count,
        raw_length,
        "FIX message parsed"
    );

    Ok(Json(ParseResponse {
        msg_type,
        fields,
        field_count,
        raw_length,
    }))
}

async fn sessions(State(state): State<AppState>) -> Json<SessionsResponse> {
    let sessions = state
        .sessions
        .lock()
        .map(|s| s.clone())
        .unwrap_or_default();
    let count = sessions.len();
    Json(SessionsResponse { sessions, count })
}

async fn validate(
    State(_state): State<AppState>,
    Json(req): Json<ValidateRequest>,
) -> Result<Json<ValidateResponse>, StatusCode> {
    let supported_versions = ["4.2", "4.4", "5.0"];
    let version_str = req.version.trim_start_matches("FIX.");
    if !supported_versions.contains(&version_str) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let msg_type = req
        .message
        .get("MsgType")
        .or_else(|| req.message.get("35"))
        .cloned()
        .unwrap_or_else(|| "Unknown".to_string());

    let mut errors: Vec<ValidationError> = Vec::new();

    // Required header fields per FIX protocol
    let required_fields: &[(&str, u32, &str)] = &[
        ("BeginString", 8, "Required header field missing."),
        ("BodyLength", 9, "Required header field missing."),
        ("MsgType", 35, "Required header field missing."),
        ("SenderCompID", 49, "Required header field missing."),
        ("TargetCompID", 56, "Required header field missing."),
        ("MsgSeqNum", 34, "Required header field missing."),
        ("SendingTime", 52, "Required header field missing."),
    ];

    for (name, tag, msg) in required_fields {
        let tag_str = tag.to_string();
        if !req.message.contains_key(*name) && !req.message.contains_key(tag_str.as_str()) {
            errors.push(ValidationError {
                field: name.to_string(),
                tag: *tag,
                message: msg.to_string(),
            });
        }
    }

    // Message-type specific required fields
    validate_msg_type_fields(&msg_type, &req.message, &mut errors);

    let valid = errors.is_empty();

    info!(
        version = %req.version,
        msg_type = %msg_type,
        valid,
        errors = errors.len(),
        "FIX message validated"
    );

    Ok(Json(ValidateResponse {
        valid,
        version: req.version,
        msg_type,
        errors,
    }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn msg_type_to_num(name: &str) -> String {
    match name {
        "NewOrderSingle" => "D",
        "ExecutionReport" => "8",
        "OrderCancelRequest" => "F",
        "MarketDataRequest" => "V",
        "Heartbeat" => "0",
        "Logon" => "A",
        "Logout" => "5",
        "TestRequest" => "1",
        "ResendRequest" => "2",
        "SessionLevelReject" => "3",
        _ => name,
    }
    .to_string()
}

fn fix_msg_type_name(code: &str) -> String {
    match code {
        "D" => "NewOrderSingle",
        "8" => "ExecutionReport",
        "F" => "OrderCancelRequest",
        "V" => "MarketDataRequest",
        "0" => "Heartbeat",
        "A" => "Logon",
        "5" => "Logout",
        "1" => "TestRequest",
        "2" => "ResendRequest",
        "3" => "SessionLevelReject",
        _ => "Unknown",
    }
    .to_string()
}

fn tag_to_name(tag: u32) -> String {
    match tag {
        8 => "BeginString",
        9 => "BodyLength",
        10 => "CheckSum",
        11 => "ClOrdID",
        17 => "ExecID",
        20 => "ExecTransType",
        21 => "HandlInst",
        22 => "SecurityIDSource",
        34 => "MsgSeqNum",
        35 => "MsgType",
        37 => "OrderID",
        38 => "OrderQty",
        39 => "OrdStatus",
        40 => "OrdType",
        44 => "Price",
        49 => "SenderCompID",
        52 => "SendingTime",
        54 => "Side",
        55 => "Symbol",
        56 => "TargetCompID",
        58 => "Text",
        60 => "TransactTime",
        146 => "NoRelatedSym",
        _ => "Unknown",
    }
    .to_string()
}

fn validate_msg_type_fields(
    msg_type: &str,
    message: &HashMap<String, String>,
    errors: &mut Vec<ValidationError>,
) {
    let has_field = |name: &str, tag: u32| -> bool {
        let tag_str = tag.to_string();
        message.contains_key(name) || message.contains_key(tag_str.as_str())
    };

    match msg_type {
        "NewOrderSingle" | "D" => {
            if !has_field("ClOrdID", 11) {
                errors.push(ValidationError {
                    field: "ClOrdID".to_string(),
                    tag: 11,
                    message: "NewOrderSingle requires ClOrdID (tag 11).".to_string(),
                });
            }
            if !has_field("Symbol", 55) {
                errors.push(ValidationError {
                    field: "Symbol".to_string(),
                    tag: 55,
                    message: "NewOrderSingle requires Symbol (tag 55).".to_string(),
                });
            }
            if !has_field("Side", 54) {
                errors.push(ValidationError {
                    field: "Side".to_string(),
                    tag: 54,
                    message: "NewOrderSingle requires Side (tag 54).".to_string(),
                });
            }
            if !has_field("OrderQty", 38) {
                errors.push(ValidationError {
                    field: "OrderQty".to_string(),
                    tag: 38,
                    message: "NewOrderSingle requires OrderQty (tag 38).".to_string(),
                });
            }
        }
        "OrderCancelRequest" | "F" => {
            if !has_field("ClOrdID", 11) {
                errors.push(ValidationError {
                    field: "ClOrdID".to_string(),
                    tag: 11,
                    message: "OrderCancelRequest requires ClOrdID (tag 11).".to_string(),
                });
            }
            if !has_field("Symbol", 55) {
                errors.push(ValidationError {
                    field: "Symbol".to_string(),
                    tag: 55,
                    message: "OrderCancelRequest requires Symbol (tag 55).".to_string(),
                });
            }
        }
        _ => {}
    }
}

fn build_fix_message(
    version: &str,
    msg_type: &str,
    sender: &str,
    target: &str,
    seq_num: u64,
    extra_fields: &HashMap<String, String>,
) -> String {
    let soh = '\x01';
    let sending_time = "20260223-00:00:00.000";

    let mut body = format!(
        "35={msg_type}{soh}49={sender}{soh}56={target}{soh}34={seq_num}{soh}52={sending_time}{soh}",
    );

    // Append caller-supplied fields (skip header fields already set)
    let skip_keys = ["BeginString", "SenderCompID", "TargetCompID", "MsgSeqNum", "SendingTime", "35", "49", "56", "34", "52"];
    for (k, v) in extra_fields {
        if !skip_keys.contains(&k.as_str()) {
            body.push_str(&format!("{k}={v}{soh}"));
        }
    }

    let body_length = body.len();
    format!("8={version}{soh}9={body_length}{soh}{body}10=000{soh}")
}

fn epoch_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn seed_sessions() -> Vec<FixSession> {
    let now = epoch_ms() / 1000;
    vec![
        FixSession {
            session_id: "ALICE->BROKER_A".to_string(),
            sender_comp_id: "ALICE".to_string(),
            target_comp_id: "BROKER_A".to_string(),
            fix_version: "FIX.4.4".to_string(),
            state: "ACTIVE".to_string(),
            msg_seq_num: 1,
            connected_at: now,
        },
        FixSession {
            session_id: "ALICE->MARKET_DATA".to_string(),
            sender_comp_id: "ALICE".to_string(),
            target_comp_id: "MARKET_DATA".to_string(),
            fix_version: "FIX.5.0".to_string(),
            state: "ACTIVE".to_string(),
            msg_seq_num: 1,
            connected_at: now,
        },
    ]
}

// ── Main ──────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("fix_engine=info,tower_http=debug")),
        )
        .init();

    let state = AppState {
        start_time: Arc::new(Instant::now()),
        sessions: Arc::new(Mutex::new(seed_sessions())),
        seq_num: Arc::new(Mutex::new(0)),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/fix/send", post(send))
        .route("/api/v1/fix/parse", post(parse))
        .route("/api/v1/fix/sessions", get(sessions))
        .route("/api/v1/fix/validate", post(validate))
        .with_state(state);

    let addr_str = std::env::var("FIX_ADDR").unwrap_or_else(|_| "0.0.0.0:8081".to_string());
    let addr: SocketAddr = addr_str.parse().expect("invalid FIX_ADDR");

    info!("ALICE FIX Engine listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind");

    axum::serve(listener, app).await.expect("server error");
}
