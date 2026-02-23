-- FIX Gateway domain tables
create table if not exists public.fix_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    session_id text unique not null,
    sender_comp_id text not null,
    target_comp_id text not null,
    fix_version text not null default 'FIX.4.4',
    state text default 'DISCONNECTED' check (state in ('ACTIVE', 'LOGON_SENT', 'LOGOUT_SENT', 'DISCONNECTED')),
    msg_seq_num bigint default 0,
    connected_at timestamptz,
    disconnected_at timestamptz,
    created_at timestamptz default now()
);
create table if not exists public.fix_messages (
    id bigserial primary key,
    session_id text references public.fix_sessions(session_id),
    direction text not null check (direction in ('inbound', 'outbound')),
    msg_type text not null,
    sequence_number bigint,
    raw_message text,
    fields jsonb,
    sent_at timestamptz default now()
);
create index idx_fix_sessions_user on public.fix_sessions(user_id);
create index idx_fix_messages_session on public.fix_messages(session_id, sent_at);
