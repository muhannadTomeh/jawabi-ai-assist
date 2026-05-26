
ALTER TABLE public.handover_settings
  ADD COLUMN IF NOT EXISTS trigger_on_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_message text NOT NULL DEFAULT 'سأقوم بتحويلك إلى أحد موظفي المبيعات لإتمام طلبك.';
