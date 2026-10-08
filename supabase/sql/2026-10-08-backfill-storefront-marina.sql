-- 2026-10-08 backfill: link storefront boats / service_orders to their marina
-- Project: aaxnoeirtjlizdhnbqbr (SailorSkills Production). NOT YET RUN.
--
-- Why: create-payment-intent upserted marinas by bare name
-- (onConflict: 'name'). Since marinas_name_unique_idx was dropped (2026-07-29)
-- that upsert fails with 42P10, so storefront orders since then wrote
-- boats.marina text but boats.marina_id / service_orders.marina_id NULL and Pro
-- shows the marina as "N/A" (e.g. ORD-1791477902104-WBVQP, Bada Bing). Before
-- 7/29 the same upsert minted free-text duplicate marinas rows.
--
-- Matching rule (same as supabase/functions/_shared/marina-match.ts):
--   key = lower(trim(name)) with internal whitespace collapsed
--   only the boat/order's OWN provider's marinas
--     (marinas.provider_id = service_providers.id;
--      boats/service_orders.provider_id = service_providers.owner_user_id)
--   ties: is_allowed first, then most boats, then oldest, then lowest id
--
-- Run order: 1) previews, 2) the transaction, 3) re-run previews (expect 0 linkable).
-- Section 4 (duplicate marinas) is read-only + a commented-out DELETE.

-- Canonical marina per (provider, key). Inlined into each statement below.
-- (Kept as a CTE rather than a view so this file creates no objects.)

-- ============================================================================
-- 1. PREVIEWS (read-only)
-- ============================================================================

-- 1a. Counts.
with canon as (
  select distinct on (m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')))
         m.id, m.name, sp.owner_user_id,
         lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')) as k
  from marinas m
  join service_providers sp on sp.id = m.provider_id
  order by m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')),
           m.is_allowed desc nulls last,
           (select count(*) from boats b where b.marina_id = m.id) desc,
           m.created_at asc, m.id asc
)
select 'boats_linkable' as what, count(*) as n
from boats b
join canon c on c.owner_user_id = b.provider_id
            and c.k = lower(regexp_replace(btrim(b.marina), '\s+', ' ', 'g'))
where b.marina_id is null
union all
select 'boats_null_marina_id_with_text_unmatched', count(*)
from boats b
where b.marina_id is null and btrim(coalesce(b.marina, '')) <> ''
  and not exists (select 1 from canon c
                  where c.owner_user_id = b.provider_id
                    and c.k = lower(regexp_replace(btrim(b.marina), '\s+', ' ', 'g')))
union all
select 'orders_linkable', count(*)
from service_orders so
join boats b on b.id = so.boat_id
left join canon c on c.owner_user_id = so.provider_id
                 and c.k = lower(regexp_replace(btrim(b.marina), '\s+', ' ', 'g'))
where so.marina_id is null
  and (c.id is not null or (b.marina_id is not null and b.provider_id = so.provider_id));

-- 1b. Rows that will change.
with canon as (
  select distinct on (m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')))
         m.id, m.name, sp.owner_user_id,
         lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')) as k
  from marinas m
  join service_providers sp on sp.id = m.provider_id
  order by m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')),
           m.is_allowed desc nulls last,
           (select count(*) from boats b where b.marina_id = m.id) desc,
           m.created_at asc, m.id asc
)
select 'boat' as kind, b.id, b.name, b.marina as marina_text, c.id as new_marina_id, c.name as canonical_name
from boats b
join canon c on c.owner_user_id = b.provider_id
            and c.k = lower(regexp_replace(btrim(b.marina), '\s+', ' ', 'g'))
where b.marina_id is null
union all
select 'order', so.id, so.order_number, b.marina,
       coalesce(case when b.provider_id = so.provider_id then b.marina_id end, c.id), c.name
from service_orders so
join boats b on b.id = so.boat_id
left join canon c on c.owner_user_id = so.provider_id
                 and c.k = lower(regexp_replace(btrim(b.marina), '\s+', ' ', 'g'))
where so.marina_id is null
  and (c.id is not null or (b.marina_id is not null and b.provider_id = so.provider_id))
order by kind, canonical_name;

-- ============================================================================
-- 2. BACKFILL (writes; Brian runs, with an explicit go)
-- ============================================================================
begin;

-- 2a. Boats: marina text matches one of the boat's provider's marinas.
with canon as (
  select distinct on (m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')))
         m.id, sp.owner_user_id,
         lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')) as k
  from marinas m
  join service_providers sp on sp.id = m.provider_id
  order by m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')),
           m.is_allowed desc nulls last,
           (select count(*) from boats b where b.marina_id = m.id) desc,
           m.created_at asc, m.id asc
)
update boats b
set marina_id = c.id
from canon c
where b.marina_id is null
  and c.owner_user_id = b.provider_id
  and c.k = lower(regexp_replace(btrim(b.marina), '\s+', ' ', 'g'));

-- 2b. Orders: take the (now linked) boat's marina when the boat is the same
--     provider's, else the text match on the boat's marina.
with canon as (
  select distinct on (m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')))
         m.id, sp.owner_user_id,
         lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')) as k
  from marinas m
  join service_providers sp on sp.id = m.provider_id
  order by m.provider_id, lower(regexp_replace(btrim(m.name), '\s+', ' ', 'g')),
           m.is_allowed desc nulls last,
           (select count(*) from boats b where b.marina_id = m.id) desc,
           m.created_at asc, m.id asc
), target as (
  select so.id as order_id,
         coalesce(case when b.provider_id = so.provider_id then b.marina_id end, c.id) as marina_id
  from service_orders so
  join boats b on b.id = so.boat_id
  left join canon c on c.owner_user_id = so.provider_id
                   and c.k = lower(regexp_replace(btrim(b.marina), '\s+', ' ', 'g'))
  where so.marina_id is null
)
update service_orders so
set marina_id = t.marina_id
from target t
where so.id = t.order_id
  and so.marina_id is null
  and t.marina_id is not null;

-- Sanity: re-run 1a here; boats_linkable and orders_linkable must be 0.
-- commit;   -- or rollback;

-- ============================================================================
-- 3. (after commit) re-run section 1a; expect boats_linkable = 0, orders_linkable = 0.
-- ============================================================================

-- ============================================================================
-- 4. DUPLICATE BERKELEY MARINAS (read-only listing + commented-out DELETE)
-- ============================================================================
-- Canonical: 18fd86eb-4e98-4c75-9679-730e27aceb2f "Berkeley Marina"
-- (provider dbd4562e = Brian Cline Marine, is_allowed, ~184 boats).
select m.id, m.name, m.provider_id, m.is_allowed, m.created_at,
       (select count(*) from boats b where b.marina_id = m.id) as boats,
       (select count(*) from service_orders so where so.marina_id = m.id) as orders,
       (select count(*) from site_attendance_intervals s where s.marina_id = m.id) as attendance
from marinas m
where m.name ilike '%berkeley%'
order by boats desc, m.name;

-- As of 2026-10-08 (read-only check), the free-text variants were:
--   6ace4772-c434-4abc-b8e4-a46adf3a429c  'berkeley'          NULL provider, allowed, 0 refs
--   c96d534f-ea13-4129-b9bc-4efc19c1d0ed  'Berkeley'          NULL provider, allowed, 0 refs
--   11381502-3a9a-42ce-8472-9cf8bed055b7  'Berkeley '         NULL provider, allowed, 0 refs
--   50aed114-36f4-4482-a129-15733f954331  'Berkeley Marina '  NULL provider, allowed, 0 refs
--   22cf1844-898b-408c-a6d7-60c7d2ed5fca  'Berkeley marina '  NULL provider, NOT allowed,
--        3 service_orders reference it (ORD-1783383032382-ARG2Y, ORD-1783383053530-YU8O0,
--        ORD-1783797751959-KV6HI, provider cdd9c3f0) -> NOT deleted here.
--
-- CAUTION: NULL-provider is_allowed rows feed the checkout marina allow-list
-- (create-payment-intent loadAllowedMarinas + substring checkMarina). The bare
-- 'Berkeley' rows are what let e.g. "Berkeley Yacht Club" through without
-- review; deleting ALL of them would push such orders to pending_review. So keep
-- one bare 'Berkeley' row (c96d534f) and drop only true duplicates.
--
-- The guard re-checks every FK (boats, service_orders, site_attendance_intervals)
-- at run time and deletes nothing that is referenced.
--
-- delete from marinas m
-- where m.id in ('6ace4772-c434-4abc-b8e4-a46adf3a429c',
--                '11381502-3a9a-42ce-8472-9cf8bed055b7',
--                '50aed114-36f4-4482-a129-15733f954331')
--   and not exists (select 1 from boats b where b.marina_id = m.id)
--   and not exists (select 1 from service_orders so where so.marina_id = m.id)
--   and not exists (select 1 from site_attendance_intervals s where s.marina_id = m.id);
