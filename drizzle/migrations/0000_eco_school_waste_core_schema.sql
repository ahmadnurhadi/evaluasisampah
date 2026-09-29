-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','school_admin','coordinator','teacher','cleaning_staff','student','principal');
CREATE TYPE public.waste_category AS ENUM ('organic','plastic','paper','cardboard','metal','glass','b3','residual','other');
CREATE TYPE public.batch_stage AS ENUM ('generated','collected','weighed','sorted','processed','utilized','sold','recycled','disposed');
CREATE TYPE public.collection_status AS ENUM ('pending','in_progress','collected','cancelled');
CREATE TYPE public.processing_method AS ENUM ('composting','recycling','reuse','upcycling','eco_enzyme','waste_bank','other');
CREATE TYPE public.finding_status AS ENUM ('open','in_progress','resolved','verified','closed');
CREATE TYPE public.severity_level AS ENUM ('low','medium','high','critical');
CREATE TYPE public.payment_status AS ENUM ('unpaid','partial','paid');

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  school_id UUID,
  avatar_url TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('super_admin','school_admin','coordinator'));
$$;

CREATE OR REPLACE FUNCTION public.can_record(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('super_admin','school_admin','coordinator','teacher','cleaning_staff','student'));
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_manager(auth.uid()));
CREATE POLICY "manager deletes profile" ON public.profiles FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));

CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'teacher'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ MASTER DATA ============
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  npsn TEXT,
  address TEXT,
  city TEXT,
  student_count INTEGER CHECK (student_count IS NULL OR student_count >= 0),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL DEFAULT 'classroom',
  description TEXT,
  qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8),'hex'),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_locations_school ON public.locations(school_id);

CREATE TABLE public.waste_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.waste_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category public.waste_category NOT NULL,
  recyclable BOOLEAN NOT NULL DEFAULT false,
  default_price_per_kg NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (default_price_per_kg >= 0),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_waste_types_category ON public.waste_types(category);

CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'waste_bank',
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ BATCHES & RECORDS ============
CREATE TABLE public.waste_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code TEXT NOT NULL UNIQUE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.waste_sources(id) ON DELETE SET NULL,
  stage public.batch_stage NOT NULL DEFAULT 'generated',
  initial_weight_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (initial_weight_kg >= 0),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_stage ON public.waste_batches(stage);
CREATE INDEX idx_batches_generated_at ON public.waste_batches(generated_at);

CREATE OR REPLACE FUNCTION public.next_batch_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d TEXT; n INTEGER;
BEGIN
  d := to_char(now(), 'YYYYMMDD');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(batch_code,'^WS-\d{8}-',''),'')::int),0)+1
    INTO n FROM public.waste_batches WHERE batch_code LIKE 'WS-'||d||'-%';
  RETURN 'WS-'||d||'-'||lpad(n::text,4,'0');
END; $$;

CREATE TABLE public.waste_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.waste_batches(id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.waste_sources(id) ON DELETE SET NULL,
  waste_type_id UUID REFERENCES public.waste_types(id) ON DELETE SET NULL,
  category public.waste_category NOT NULL DEFAULT 'other',
  weight_kg NUMERIC(12,3) NOT NULL CHECK (weight_kg >= 0),
  unit TEXT NOT NULL DEFAULT 'kg',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reporter_id UUID,
  photo_url TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_records_recorded_at ON public.waste_records(recorded_at);
CREATE INDEX idx_records_category ON public.waste_records(category);
CREATE INDEX idx_records_location ON public.waste_records(location_id);

CREATE TABLE public.waste_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.waste_batches(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.waste_sources(id) ON DELETE SET NULL,
  collector_id UUID,
  collector_name TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_weight_kg NUMERIC(12,3) CHECK (estimated_weight_kg IS NULL OR estimated_weight_kg >= 0),
  actual_weight_kg NUMERIC(12,3) CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
  status public.collection_status NOT NULL DEFAULT 'collected',
  photo_url TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_collections_batch ON public.waste_collections(batch_id);

CREATE TABLE public.waste_sorting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.waste_batches(id) ON DELETE CASCADE,
  category public.waste_category NOT NULL,
  waste_type_id UUID REFERENCES public.waste_types(id) ON DELETE SET NULL,
  weight_kg NUMERIC(12,3) NOT NULL CHECK (weight_kg >= 0),
  sorted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sorted_by UUID,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sorting_batch ON public.waste_sorting(batch_id);

CREATE TABLE public.waste_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.waste_batches(id) ON DELETE CASCADE,
  stage public.batch_stage NOT NULL,
  description TEXT,
  weight_kg NUMERIC(12,3) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  photo_url TEXT,
  actor_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_batch ON public.waste_movements(batch_id, occurred_at);

CREATE TABLE public.waste_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.waste_batches(id) ON DELETE CASCADE,
  method public.processing_method NOT NULL,
  input_weight_kg NUMERIC(12,3) NOT NULL CHECK (input_weight_kg >= 0),
  output_weight_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (output_weight_kg >= 0),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responsible_id UUID,
  responsible_name TEXT,
  result TEXT,
  photo_url TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_processing_batch ON public.waste_processing(batch_id);

CREATE TABLE public.waste_utilization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.waste_batches(id) ON DELETE CASCADE,
  utilization_type TEXT NOT NULL,
  weight_kg NUMERIC(12,3) NOT NULL CHECK (weight_kg >= 0),
  destination TEXT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  economic_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (economic_value >= 0),
  photo_url TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_utilization_batch ON public.waste_utilization(batch_id);

CREATE TABLE public.waste_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT NOT NULL UNIQUE DEFAULT ('TRX-'||to_char(now(),'YYYYMMDD')||'-'||upper(encode(gen_random_bytes(3),'hex'))),
  batch_id UUID REFERENCES public.waste_batches(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  waste_type_id UUID REFERENCES public.waste_types(id) ON DELETE SET NULL,
  category public.waste_category NOT NULL DEFAULT 'plastic',
  weight_kg NUMERIC(12,3) NOT NULL CHECK (weight_kg >= 0),
  price_per_kg NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_per_kg >= 0),
  total_value NUMERIC(14,2) GENERATED ALWAYS AS (weight_kg * price_per_kg) STORED,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_sold_at ON public.waste_sales(sold_at);

CREATE TABLE public.residual_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.waste_batches(id) ON DELETE CASCADE,
  weight_kg NUMERIC(12,3) NOT NULL CHECK (weight_kg >= 0),
  destination TEXT,
  disposal_method TEXT,
  transporter TEXT,
  disposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_url TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ AUDIT ============
CREATE TABLE public.audit_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  max_score INTEGER NOT NULL DEFAULT 100 CHECK (max_score > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  auditor_id UUID,
  auditor_name TEXT,
  audited_at DATE NOT NULL DEFAULT CURRENT_DATE,
  total_score NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  photo_url TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.audit_indicators(id) ON DELETE CASCADE,
  score NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (score >= 0),
  note TEXT,
  UNIQUE (audit_id, indicator_id)
);

CREATE TABLE public.audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_code TEXT NOT NULL UNIQUE DEFAULT ('F-'||to_char(now(),'YYYYMMDD')||'-'||upper(encode(gen_random_bytes(3),'hex'))),
  audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'kebersihan',
  description TEXT NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'medium',
  recommendation TEXT,
  photo_url TEXT,
  pic_id UUID,
  pic_name TEXT,
  due_date DATE,
  status public.finding_status NOT NULL DEFAULT 'open',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_findings_status ON public.audit_findings(status);

CREATE TABLE public.action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.audit_findings(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  pic_name TEXT,
  due_date DATE,
  status public.finding_status NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  photo_url TEXT,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ ACTIVITIES ============
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  organizer TEXT,
  participant_count INTEGER NOT NULL DEFAULT 0 CHECK (participant_count >= 0),
  waste_collected_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (waste_collected_kg >= 0),
  waste_utilized_kg NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (waste_utilized_kg >= 0),
  description TEXT,
  result TEXT,
  photo_url TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.evidence_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_entity ON public.evidence_photos(entity_type, entity_id);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);

-- ============ GRANTS + RLS FOR SHARED TABLES ============
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schools','locations','waste_sources','waste_types','partners','waste_batches','waste_records',
    'waste_collections','waste_sorting','waste_movements','waste_processing','waste_utilization',
    'waste_sales','residual_disposals','audit_indicators','audits','audit_scores','audit_findings',
    'action_plans','activities','activity_participants','evidence_photos'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "read all authenticated" ON public.%I FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "insert by recorder" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_record(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "update by recorder" ON public.%I FOR UPDATE TO authenticated USING (public.can_record(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "delete by manager" ON public.%I FOR DELETE TO authenticated USING (public.is_manager(auth.uid()));', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));

-- updated_at triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','schools','locations','waste_batches','waste_records','waste_collections','audits','audit_findings','action_plans','activities'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

-- ============ MASS BALANCE VALIDATION ============
CREATE OR REPLACE FUNCTION public.validate_sorting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE batch_w NUMERIC; sorted_w NUMERIC;
BEGIN
  SELECT initial_weight_kg INTO batch_w FROM public.waste_batches WHERE id = NEW.batch_id;
  SELECT COALESCE(SUM(weight_kg),0) INTO sorted_w FROM public.waste_sorting
    WHERE batch_id = NEW.batch_id AND deleted_at IS NULL AND id <> NEW.id;
  IF batch_w IS NOT NULL AND sorted_w + NEW.weight_kg > batch_w + 0.001 THEN
    RAISE EXCEPTION 'Total berat pilahan (%) melebihi berat batch (%)', sorted_w + NEW.weight_kg, batch_w;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_validate_sorting BEFORE INSERT OR UPDATE ON public.waste_sorting
FOR EACH ROW EXECUTE FUNCTION public.validate_sorting();

-- movement log on batch stage change
CREATE OR REPLACE FUNCTION public.log_batch_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.waste_movements (batch_id, stage, description, weight_kg, actor_id)
    VALUES (NEW.id, NEW.stage, 'Tahap batch: '||NEW.stage, NEW.initial_weight_kg, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_log_batch_stage AFTER INSERT OR UPDATE ON public.waste_batches
FOR EACH ROW EXECUTE FUNCTION public.log_batch_stage();

-- ============ DEMO / MASTER SEED ============
INSERT INTO public.waste_sources (name, description) VALUES
 ('Kelas','Sampah dari ruang kelas'),
 ('Kantin','Sampah dari kantin sekolah'),
 ('Taman','Daun dan ranting dari taman'),
 ('Kantor / TU','Sampah administrasi'),
 ('Laboratorium','Termasuk limbah B3'),
 ('Toilet','Sampah dari area toilet'),
 ('Kegiatan / Event','Sampah dari kegiatan sekolah');

INSERT INTO public.waste_types (name, category, recyclable, default_price_per_kg) VALUES
 ('Sisa makanan','organic',false,0),
 ('Daun & ranting','organic',false,0),
 ('Botol plastik PET','plastic',true,4000),
 ('Kantong plastik','plastic',true,1000),
 ('Kertas HVS','paper',true,2500),
 ('Koran','paper',true,1500),
 ('Kardus','cardboard',true,2000),
 ('Kaleng aluminium','metal',true,12000),
 ('Besi','metal',true,5000),
 ('Botol kaca','glass',true,500),
 ('Baterai bekas','b3',false,0),
 ('Lampu bekas','b3',false,0),
 ('Tisu & popok','residual',false,0),
 ('Lainnya','other',false,0);

INSERT INTO public.audit_indicators (name, description, weight, max_score) VALUES
 ('Kebersihan area','Kondisi kebersihan umum lokasi',1.5,100),
 ('Pemilahan sampah','Ketepatan pemilahan di tempat sampah',2.0,100),
 ('Kondisi tempat sampah','Kelayakan dan kelengkapan tempat sampah',1.0,100),
 ('Kontaminasi sampah','Tingkat tercampurnya sampah antar kategori',1.5,100),
 ('Kepatuhan pengangkutan','Ketepatan jadwal pengangkutan',1.0,100),
 ('Perilaku lingkungan','Perilaku warga sekolah terhadap sampah',1.0,100);

INSERT INTO public.schools (id, name, npsn, address, city, student_count, is_demo) VALUES
 ('11111111-1111-1111-1111-111111111111','SMA Negeri 1 Contoh (DEMO)','20100001','Jl. Pendidikan No. 1','Jakarta',960,true);

INSERT INTO public.locations (school_id, name, code, type, is_demo) VALUES
 ('11111111-1111-1111-1111-111111111111','Kelas X-1','X1','classroom',true),
 ('11111111-1111-1111-1111-111111111111','Kelas XI-2','XI2','classroom',true),
 ('11111111-1111-1111-1111-111111111111','Kantin Sekolah','KTN','canteen',true),
 ('11111111-1111-1111-1111-111111111111','Taman Depan','TMN','garden',true),
 ('11111111-1111-1111-1111-111111111111','TPS Sekolah','TPS','collection_point',true),
 ('11111111-1111-1111-1111-111111111111','Ruang Guru','RG','office',true);

INSERT INTO public.partners (name, type, contact_person, phone, is_demo) VALUES
 ('Bank Sampah Melati (DEMO)','waste_bank','Ibu Sri','081200000001',true),
 ('CV Daur Ulang Nusantara (DEMO)','recycler','Pak Budi','081200000002',true);
