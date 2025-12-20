-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create markets table
CREATE TABLE public.markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create market_prices table
CREATE TABLE public.market_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(market_id, product_id)
);

-- Create shopping_lists table
CREATE TABLE public.shopping_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create list_items table
CREATE TABLE public.list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- Products: readable by all authenticated users
CREATE POLICY "Products are viewable by authenticated users"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Markets: readable by all authenticated users, insertable by authenticated users
CREATE POLICY "Markets are viewable by authenticated users"
  ON public.markets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create markets"
  ON public.markets FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Market prices: readable by all authenticated users, manageable by authenticated users
CREATE POLICY "Market prices are viewable by authenticated users"
  ON public.market_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage market prices"
  ON public.market_prices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update market prices"
  ON public.market_prices FOR UPDATE
  TO authenticated
  USING (true);

-- Shopping lists: users can only access their own lists
CREATE POLICY "Users can view their own lists"
  ON public.shopping_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lists"
  ON public.shopping_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON public.shopping_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
  ON public.shopping_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- List items: users can manage items in their own lists
CREATE POLICY "Users can view items in their lists"
  ON public.list_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shopping_lists 
    WHERE id = list_items.list_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can add items to their lists"
  ON public.list_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shopping_lists 
    WHERE id = list_items.list_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update items in their lists"
  ON public.list_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shopping_lists 
    WHERE id = list_items.list_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their lists"
  ON public.list_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shopping_lists 
    WHERE id = list_items.list_id AND user_id = auth.uid()
  ));

-- Seed products with 20 common Brazilian grocery items
INSERT INTO public.products (name, brand, image_url) VALUES
  ('Arroz', 'Tio João', null),
  ('Feijão Preto', 'Camil', null),
  ('Feijão Carioca', 'Kicaldo', null),
  ('Café', 'Pilão', null),
  ('Leite Integral', 'Italac', null),
  ('Açúcar', 'União', null),
  ('Óleo de Soja', 'Soya', null),
  ('Macarrão Espaguete', 'Barilla', null),
  ('Farinha de Trigo', 'Dona Benta', null),
  ('Sal', 'Cisne', null),
  ('Manteiga', 'Aviação', null),
  ('Ovos (dúzia)', null, null),
  ('Banana (kg)', null, null),
  ('Tomate (kg)', null, null),
  ('Cebola (kg)', null, null),
  ('Batata (kg)', null, null),
  ('Frango (kg)', 'Sadia', null),
  ('Leite Condensado', 'Moça', null),
  ('Achocolatado', 'Nescau', null),
  ('Biscoito Cream Cracker', 'Bauducco', null);