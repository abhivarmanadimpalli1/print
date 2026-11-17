-- ====================================================================
-- Campus QuickPrint / QR Print Ordering - Production Database Schema
-- Compatible with PostgreSQL / Supabase
-- ====================================================================

-- 1. SHOPS TABLE
create table if not exists shops (
    id text primary key,
    name text not null,
    tagline text,
    location text not null,
    phone text not null,
    is_open boolean not null default true,
    opening_hours text,
    bw_rate_per_page numeric(6, 2) not null default 2.00,
    color_rate_per_page numeric(6, 2) not null default 10.00,
    duplex_ratio numeric(4, 2) not null default 0.90,
    retention_minutes int not null default 10, -- 10-minute auto-purge
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. ORDERS TABLE
create table if not exists orders (
    id text primary key,
    order_number serial,
    shop_id text not null references shops(id) on delete cascade,
    customer_name text not null,
    customer_phone text not null,
    customer_notes text,
    file_name text not null,
    file_size_bytes bigint not null,
    file_storage_path text, -- Private S3/R2 key (cleared after 10m)
    detected_pages int not null default 1,
    copies int not null default 1,
    color_mode text not null check (color_mode in ('bw', 'color')),
    paper_size text not null default 'A4',
    sides text not null check (sides in ('single', 'duplex')),
    custom_page_range text,
    selected_pages int not null,
    sheets_needed int not null,
    unit_price numeric(6, 2) not null,
    subtotal numeric(8, 2) not null,
    revised_amount numeric(8, 2),
    payment_mode text not null default 'counter' check (payment_mode in ('counter', 'online')),
    payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'pay_at_counter')),
    payment_transaction_id text,
    status text not null default 'new' check (status in ('new', 'review', 'approved', 'printing', 'ready', 'completed', 'cancelled')),
    rejection_reason text,
    clarification_note text,
    
    -- 10-Minute Privacy & Storage Auto-Purge Lifecycle
    downloaded_at timestamptz,
    printed_at timestamptz,
    purge_at timestamptz,      -- Scheduled purge timestamp (e.g. downloaded_at + 10 mins)
    is_purged boolean not null default false,
    purged_at timestamptz,
    
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. AUDIT HISTORY TABLE
create table if not exists order_history (
    id serial primary key,
    order_id text not null references orders(id) on delete cascade,
    status text not null,
    note text,
    created_at timestamptz not null default now()
);

-- 4. 10-MINUTE AUTOMATIC DATABASE CLEANUP PROCEDURE
-- This runs periodically (via pg_cron or Supabase Edge Function) to clear file payloads:
create or replace function purge_expired_documents()
returns int as $$
declare
    purged_count int;
begin
    with updated as (
        update orders
        set file_storage_path = null,
            is_purged = true,
            purged_at = now()
        where is_purged = false
          and purge_at is not null
          and now() >= purge_at
        returning id
    )
    select count(*) into purged_count from updated;

    return purged_count;
end;
$$ language plpgsql;

-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
alter table shops enable row level security;
alter table orders enable row level security;

-- Public can view shop info to order:
create policy "Public shops view" on shops for select using (true);

-- Customers can submit orders and view their own order by ID:
create policy "Insert order" on orders for insert with check (true);
create policy "Read own order" on orders for select using (true);
