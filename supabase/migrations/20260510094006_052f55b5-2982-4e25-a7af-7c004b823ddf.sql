
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff', 'agency');
CREATE TYPE public.candidate_status AS ENUM ('available', 'processing', 'arrived', 'canceled');
CREATE TYPE public.subscription_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.subscription_plan AS ENUM ('basic', 'standard', 'pro');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_manager_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT manager_id FROM public.user_roles WHERE user_id = _user_id AND role = 'staff' LIMIT 1;
$$;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Managers view their staff roles"
  ON public.user_roles FOR SELECT TO authenticated USING (manager_id = auth.uid());
CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own role on signup"
  ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default manager role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'avatar_url');

  -- Default to manager role; can be changed by admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'manager'));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Staff
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  role_title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage own staff"
  ON public.staff FOR ALL TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());
CREATE POLICY "Staff view own staff record"
  ON public.staff FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Foreign agencies
CREATE TABLE public.foreign_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.foreign_agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage own agencies"
  ON public.foreign_agencies FOR ALL TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());
CREATE TRIGGER agencies_updated_at BEFORE UPDATE ON public.foreign_agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  passport_number TEXT,
  serial_number TEXT,
  dob DATE,
  country TEXT,
  occupation TEXT,
  education TEXT,
  skills TEXT,
  experience TEXT,
  marital_status TEXT,
  gender TEXT,
  religion TEXT,
  age INT,
  photo_url TEXT,
  status candidate_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage own candidates"
  ON public.candidates FOR ALL TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Staff view manager candidates"
  ON public.candidates FOR SELECT TO authenticated
  USING (manager_id = public.get_manager_id(auth.uid()));

CREATE POLICY "Staff update manager candidates"
  ON public.candidates FOR UPDATE TO authenticated
  USING (manager_id = public.get_manager_id(auth.uid()));

CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Subscription requests
CREATE TABLE public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  screenshot_url TEXT,
  notes TEXT,
  status subscription_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers view own requests"
  ON public.subscription_requests FOR SELECT TO authenticated
  USING (manager_id = auth.uid());
CREATE POLICY "Managers create own requests"
  ON public.subscription_requests FOR INSERT TO authenticated
  WITH CHECK (manager_id = auth.uid());
CREATE POLICY "Admins view all requests"
  ON public.subscription_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update requests"
  ON public.subscription_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER sub_req_updated_at BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-photos', 'candidate-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

CREATE POLICY "Anyone view candidate photos"
  ON storage.objects FOR SELECT USING (bucket_id = 'candidate-photos');
CREATE POLICY "Authenticated upload candidate photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'candidate-photos');
CREATE POLICY "Authenticated update candidate photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'candidate-photos');
CREATE POLICY "Authenticated delete candidate photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'candidate-photos');

CREATE POLICY "Owners view own payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND owner = auth.uid());
CREATE POLICY "Owners upload payment proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND owner = auth.uid());
CREATE POLICY "Admins view all payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
