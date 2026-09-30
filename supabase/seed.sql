-- Run after migrations 0000-0014. These rows are isolated demo data.
-- Demo school ID: d0000000-0000-4000-8000-000000000001
BEGIN;

INSERT INTO public.schools (id, name, npsn, address, city, student_count, is_demo)
VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'Sekolah Demo Eco-School',
  'DEMO00001',
  'Jl. Pendidikan No. 1',
  'Bandung',
  620,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  npsn = EXCLUDED.npsn,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  student_count = EXCLUDED.student_count,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.locations (id, school_id, name, code, type, description, is_demo)
VALUES (
  'd1000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'Area Kantin dan Taman',
  'DEMO-AREA-01',
  'other',
  'Lokasi contoh untuk data demo.',
  true
)
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.waste_sources (id, school_id, name, description, is_demo)
VALUES (
  'd2000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'Kantin Demo',
  'Sumber contoh untuk enam catatan sampah.',
  true
)
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.waste_types (id, school_id, name, category, recyclable, default_price_per_kg, is_demo)
VALUES
  ('d3000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Sisa makanan demo', 'organic', false, 0, true),
  ('d3000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Botol plastik demo', 'plastic', true, 8000, true),
  ('d3000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'Kertas demo', 'paper', true, 2500, true),
  ('d3000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'Kardus demo', 'cardboard', true, 1800, true)
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  recyclable = EXCLUDED.recyclable,
  default_price_per_kg = EXCLUDED.default_price_per_kg,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.partners (id, school_id, name, type, contact_person, phone, address, is_demo)
VALUES (
  'd4000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'Bank Sampah Demo',
  'waste_bank',
  'Petugas Demo',
  '080000000001',
  'Bandung',
  true
)
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  contact_person = EXCLUDED.contact_person,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.waste_batches (
  id, batch_code, school_id, location_id, source_id, stage,
  initial_weight_kg, generated_at, notes, is_demo
)
VALUES
  ('d5000000-0000-4000-8000-000000000001', 'DEMO-WS-001', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'generated', 12, now() - interval '6 days', 'Demo: sisa makanan diolah menjadi kompos.', true),
  ('d5000000-0000-4000-8000-000000000002', 'DEMO-WS-002', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'generated', 8, now() - interval '5 days', 'Demo: botol plastik dijual ke bank sampah.', true),
  ('d5000000-0000-4000-8000-000000000003', 'DEMO-WS-003', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'generated', 5, now() - interval '4 days', 'Demo: kertas dipilah dan dijual.', true),
  ('d5000000-0000-4000-8000-000000000004', 'DEMO-WS-004', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'generated', 3.2, now() - interval '3 days', 'Demo: residu dibuang ke tempat pemrosesan akhir.', true),
  ('d5000000-0000-4000-8000-000000000005', 'DEMO-WS-005', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'generated', 9, now() - interval '2 days', 'Demo: sampah organik dimanfaatkan di kebun sekolah.', true),
  ('d5000000-0000-4000-8000-000000000006', 'DEMO-WS-006', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'generated', 7, now() - interval '1 day', 'Demo: kardus didaur ulang.', true)
ON CONFLICT (id) DO UPDATE SET
  batch_code = EXCLUDED.batch_code,
  school_id = EXCLUDED.school_id,
  location_id = EXCLUDED.location_id,
  source_id = EXCLUDED.source_id,
  stage = 'generated',
  initial_weight_kg = EXCLUDED.initial_weight_kg,
  generated_at = EXCLUDED.generated_at,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.waste_records (
  id, batch_id, school_id, location_id, source_id, waste_type_id,
  category, weight_kg, recorded_at, notes, is_demo
)
VALUES
  ('d6000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'organic', 12, now() - interval '6 days', 'Sisa makanan setelah jam istirahat.', true),
  ('d6000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002', 'plastic', 8, now() - interval '5 days', 'Botol plastik bekas minuman.', true),
  ('d6000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000003', 'paper', 5, now() - interval '4 days', 'Kertas dari kegiatan belajar.', true),
  ('d6000000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', NULL, 'residual', 3.2, now() - interval '3 days', 'Sampah residu yang tidak dapat dipilah kembali.', true),
  ('d6000000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'organic', 9, now() - interval '2 days', 'Daun dan sisa makanan untuk kebun sekolah.', true),
  ('d6000000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000004', 'cardboard', 7, now() - interval '1 day', 'Kardus kemasan dari kantin.', true)
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  school_id = EXCLUDED.school_id,
  location_id = EXCLUDED.location_id,
  source_id = EXCLUDED.source_id,
  waste_type_id = EXCLUDED.waste_type_id,
  category = EXCLUDED.category,
  weight_kg = EXCLUDED.weight_kg,
  recorded_at = EXCLUDED.recorded_at,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.waste_collections (
  id, batch_id, location_id, source_id, collector_name, collected_at,
  estimated_weight_kg, actual_weight_kg, status, notes, is_demo
)
VALUES
  ('d7000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Petugas Demo', now() - interval '6 days' + interval '2 hours', 12, 11.5, 'collected', 'Demo pengumpulan.', true),
  ('d7000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Petugas Demo', now() - interval '5 days' + interval '2 hours', 8, 8, 'collected', 'Demo pengumpulan.', true),
  ('d7000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Petugas Demo', now() - interval '4 days' + interval '2 hours', 5, 4.7, 'collected', 'Demo pengumpulan.', true),
  ('d7000000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Petugas Demo', now() - interval '3 days' + interval '2 hours', 3.2, 3, 'collected', 'Demo pengumpulan.', true),
  ('d7000000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Petugas Demo', now() - interval '2 days' + interval '2 hours', 9, 8.7, 'collected', 'Demo pengumpulan.', true),
  ('d7000000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Petugas Demo', now() - interval '1 day' + interval '2 hours', 7, 6.8, 'collected', 'Demo pengumpulan.', true)
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  location_id = EXCLUDED.location_id,
  source_id = EXCLUDED.source_id,
  collector_name = EXCLUDED.collector_name,
  collected_at = EXCLUDED.collected_at,
  estimated_weight_kg = EXCLUDED.estimated_weight_kg,
  actual_weight_kg = EXCLUDED.actual_weight_kg,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

UPDATE public.waste_batches
SET stage = 'collected', collected_at = now() - interval '1 hour'
WHERE id IN (
  'd5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002',
  'd5000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000004',
  'd5000000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000006'
);

INSERT INTO public.waste_sorting (id, batch_id, category, waste_type_id, weight_kg, sorted_at, notes, is_demo)
VALUES
  ('d8000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'organic', 'd3000000-0000-4000-8000-000000000001', 11, now() - interval '5 days', 'Hasil pilah demo.', true),
  ('d8000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', 'plastic', 'd3000000-0000-4000-8000-000000000002', 7.5, now() - interval '4 days', 'Hasil pilah demo.', true),
  ('d8000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000003', 'paper', 'd3000000-0000-4000-8000-000000000003', 4.5, now() - interval '3 days', 'Hasil pilah demo.', true),
  ('d8000000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000004', 'residual', NULL, 2.8, now() - interval '2 days', 'Hasil pilah demo.', true),
  ('d8000000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000005', 'organic', 'd3000000-0000-4000-8000-000000000001', 8.4, now() - interval '1 day', 'Hasil pilah demo.', true),
  ('d8000000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000006', 'cardboard', 'd3000000-0000-4000-8000-000000000004', 6.5, now(), 'Hasil pilah demo.', true)
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  category = EXCLUDED.category,
  waste_type_id = EXCLUDED.waste_type_id,
  weight_kg = EXCLUDED.weight_kg,
  sorted_at = EXCLUDED.sorted_at,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

UPDATE public.waste_batches
SET stage = 'sorted'
WHERE id IN (
  'd5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002',
  'd5000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000004',
  'd5000000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000006'
);

INSERT INTO public.waste_processing (
  id, batch_id, method, input_weight_kg, output_weight_kg, processed_at,
  responsible_name, result, notes, is_demo
)
VALUES
  ('d9000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'composting', 10, 3.2, now() - interval '4 days', 'Petugas Demo', 'Kompos untuk taman sekolah.', 'Demo pengolahan.', true),
  ('d9000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000005', 'eco_enzyme', 8, 3, now() - interval '12 hours', 'Petugas Demo', 'Eco-enzyme untuk kebersihan sekolah.', 'Demo pengolahan.', true),
  ('d9000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000006', 'recycling', 6, 4, now() - interval '6 hours', 'Petugas Demo', 'Kardus siap didaur ulang.', 'Demo pengolahan.', true)
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  method = EXCLUDED.method,
  input_weight_kg = EXCLUDED.input_weight_kg,
  output_weight_kg = EXCLUDED.output_weight_kg,
  processed_at = EXCLUDED.processed_at,
  responsible_name = EXCLUDED.responsible_name,
  result = EXCLUDED.result,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

UPDATE public.waste_batches
SET stage = 'processed'
WHERE id IN (
  'd5000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000005',
  'd5000000-0000-4000-8000-000000000006'
);

INSERT INTO public.waste_utilization (
  id, batch_id, utilization_type, weight_kg, destination, partner_id,
  used_at, economic_value, notes, is_demo
)
VALUES
  ('da000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'Kompos', 2, 'Taman sekolah', 'd4000000-0000-4000-8000-000000000001', now() - interval '3 days', 25000, 'Demo pemanfaatan.', true),
  ('da000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000005', 'Eco-enzyme', 2, 'Kebersihan sekolah', 'd4000000-0000-4000-8000-000000000001', now() - interval '6 hours', 15000, 'Demo pemanfaatan.', true)
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  utilization_type = EXCLUDED.utilization_type,
  weight_kg = EXCLUDED.weight_kg,
  destination = EXCLUDED.destination,
  partner_id = EXCLUDED.partner_id,
  used_at = EXCLUDED.used_at,
  economic_value = EXCLUDED.economic_value,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.waste_sales (
  id, transaction_code, batch_id, partner_id, waste_type_id, category,
  weight_kg, price_per_kg, sold_at, payment_status, notes, is_demo
)
VALUES
  ('db000000-0000-4000-8000-000000000001', 'DEMO-TRX-001', 'd5000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002', 'plastic', 6.5, 8000, now() - interval '3 days', 'paid', 'Demo penjualan botol plastik.', true),
  ('db000000-0000-4000-8000-000000000002', 'DEMO-TRX-002', 'd5000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000003', 'paper', 4, 2500, now() - interval '2 days', 'paid', 'Demo penjualan kertas.', true)
ON CONFLICT (id) DO UPDATE SET
  transaction_code = EXCLUDED.transaction_code,
  batch_id = EXCLUDED.batch_id,
  partner_id = EXCLUDED.partner_id,
  waste_type_id = EXCLUDED.waste_type_id,
  category = EXCLUDED.category,
  weight_kg = EXCLUDED.weight_kg,
  price_per_kg = EXCLUDED.price_per_kg,
  sold_at = EXCLUDED.sold_at,
  payment_status = EXCLUDED.payment_status,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

INSERT INTO public.residual_disposals (
  id, batch_id, weight_kg, destination, disposal_method, transporter,
  disposed_at, notes, is_demo
)
VALUES (
  'dc000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000004',
  2.5,
  'TPA Sarimukti',
  'Pengangkutan resmi',
  'Petugas Demo',
  now() - interval '1 day',
  'Demo pembuangan residu.',
  true
)
ON CONFLICT (id) DO UPDATE SET
  batch_id = EXCLUDED.batch_id,
  weight_kg = EXCLUDED.weight_kg,
  destination = EXCLUDED.destination,
  disposal_method = EXCLUDED.disposal_method,
  transporter = EXCLUDED.transporter,
  disposed_at = EXCLUDED.disposed_at,
  notes = EXCLUDED.notes,
  is_demo = true,
  deleted_at = NULL;

UPDATE public.waste_batches SET stage = 'utilized'
WHERE id IN ('d5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000005');
UPDATE public.waste_batches SET stage = 'sold'
WHERE id IN ('d5000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000003');
UPDATE public.waste_batches SET stage = 'disposed'
WHERE id = 'd5000000-0000-4000-8000-000000000004';
UPDATE public.waste_batches SET stage = 'recycled'
WHERE id = 'd5000000-0000-4000-8000-000000000006';

COMMIT;
