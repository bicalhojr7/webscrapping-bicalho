-- Tabela de Leads
CREATE TABLE public.leads (
    id TEXT PRIMARY KEY, -- Será o placeId do Google
    place_id TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    website_uri TEXT,
    google_maps_uri TEXT,
    editorial_summary TEXT,
    business_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'google_places',
    site_url TEXT,
    github_url TEXT,
    stitch_project_id TEXT,
    stitch_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar o RLS (Row Level Security)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Permitir acesso completo para usuários autenticados (Sócio da plataforma)
CREATE POLICY "Leads all operations for authenticated users" 
ON public.leads 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Criar a função de atualização do updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
