-- Disposable PostgreSQL acceptance. Never run against a live Supabase project.
do $$
begin
 if (select public from storage.buckets where id='flyer-product-photos') then
  raise exception 'Photo library bucket unexpectedly public';
 end if;
 if has_table_privilege('anon','public.flyer_product_photos','SELECT')
  or has_table_privilege('authenticated','public.flyer_product_photos','SELECT')
  or has_table_privilege('anon','public.flyer_product_photo_blobs','INSERT')
  or has_table_privilege('authenticated','public.flyer_product_photo_audit','SELECT')
 then raise exception 'Private photo tables unexpectedly readable or writable by browser roles';
 end if;
 if not has_function_privilege('service_role','public.flyer_product_photo_set_primary(text,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.flyer_product_photo_set_primary(text,uuid)','EXECUTE')
 then raise exception 'Primary setter privileges violate service-only contract';
 end if;
end $$;
insert into public.flyer_product_photo_blobs(sha256,storage_path,thumbnail_path,mime_type,byte_size,thumbnail_bytes,uploaded_by_ptg)
values
 (repeat('a',64),'images/a/a.webp','thumbs/a/a.webp','image/webp',500,120,'11111111-1111-4111-8111-111111111111'),
 (repeat('b',64),'images/b/b.webp','thumbs/b/b.webp','image/webp',500,120,'11111111-1111-4111-8111-111111111111');
insert into public.flyer_product_photos(id,product_key,barcode_norm,brand_norm,model_norm,description,blob_id,uploaded_by_ptg,updated_by_ptg)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b:000123','000123','LG','T123','LG TV T123',
 id,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'
from public.flyer_product_photo_blobs where sha256=repeat('a',64);
insert into public.flyer_product_photos(id,product_key,barcode_norm,brand_norm,model_norm,description,blob_id,uploaded_by_ptg,updated_by_ptg)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b:000123','000123','LG','T123','LG TV T123',
 id,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'
from public.flyer_product_photo_blobs where sha256=repeat('b',64);
do $$
begin
 if public.flyer_product_photo_set_primary('b:000123','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is distinct from true
 then raise exception 'Could not set first primary'; end if;
 if public.flyer_product_photo_set_primary('b:000123','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is distinct from true
 then raise exception 'Could not switch primary'; end if;
 if (select count(*) from public.flyer_product_photos where product_key='b:000123' and is_primary and deleted_at is null)<>1
 then raise exception 'Expected exactly one primary'; end if;
 if (select is_primary from public.flyer_product_photos where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 then raise exception 'Old primary was not cleared'; end if;
 if public.flyer_product_photo_set_primary('b:OTHER','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is distinct from false
 then raise exception 'Cross-product primary switching was accepted'; end if;
 begin
  update public.flyer_product_photos set is_primary=true
  where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  raise exception 'Concurrent primary uniqueness was not enforced';
 exception when unique_violation then null;
 end;
end $$;
