-- Private evidence storage. Access is brokered by authenticated server routes only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('billing-receipts','billing-receipts',false,10485760,array['image/png','image/jpeg','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/png','image/jpeg','application/pdf'];
