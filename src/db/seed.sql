-- Demo seed data for local/remote D1. Run via `npm run db:seed:local` or
-- `npm run db:seed:remote` after applying migrations.
--
-- Category `section` values route items to their dedicated public page:
-- 'burgers' -> /burgers, 'appetizers' -> /appetizers, 'drinks' -> /drinks.
-- Lunch Specials has no section — it only surfaces via the homepage
-- "today's special" banner (GET /api/specials), not a menu page.

INSERT INTO menu_categories (id, name, display_order, image_url, section) VALUES
  (1, 'Draft Beers', 1, '/assets/drink.webp', 'drinks'),
  (2, 'Lunch Specials', 2, NULL, NULL),
  (3, 'Burgers & Sandwiches', 1, NULL, 'burgers'),
  (4, 'Appetizers', 1, NULL, 'appetizers'),
  (5, 'Bottled & Canned Beers', 2, NULL, 'drinks'),
  (6, 'House Cocktails', 3, NULL, 'drinks'),
  (7, 'Non-Alcoholic', 4, NULL, 'drinks');

INSERT INTO menu_items (category_id, name, description, price, abv, image_url, day_of_week, is_available, is_active, is_local, is_gluten_free, display_order, servings_remaining) VALUES
  -- Draft Beers
  (1, 'Rhythm Pale Ale', 'American Pale Ale', 7.00, 5.4, NULL, NULL, 1, 1, 1, 0, 1, 48),
  (1, 'Brews Brothers Stout', 'Oatmeal Stout', 7.50, 6.1, NULL, NULL, 1, 1, 1, 0, 2, 40),
  (1, 'Backbeat IPA', 'West Coast IPA', 8.00, 6.8, NULL, NULL, 1, 1, 1, 0, 3, 55),
  (1, 'Encore Wheat', 'Hefeweizen', 7.00, 4.9, NULL, NULL, 0, 1, 0, 0, 4, 0),
  (1, 'Downbeat Lager', 'Vienna Lager', 7.00, 5.0, NULL, NULL, 1, 1, 1, 0, 5, 60),
  (1, 'Solo Sour', 'Berliner Weisse', 7.50, 4.2, NULL, NULL, 1, 1, 0, 1, 6, 22),
  -- Real weekly lunch specials from the venue's own promo flyer.
  -- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
  (2, 'Chicken Salad Sandwich', 'Tuesday special · served with fresh chips', 8.99, NULL, NULL, 2, 1, 1, 0, 0, 1, NULL),
  (2, 'Wrap Wednesday', 'Any wrap, served with fresh chips', 8.99, NULL, NULL, 3, 1, 1, 0, 0, 2, NULL),
  (2, 'Hamburger Special', 'Thursday special · served with fresh chips', 8.99, NULL, '/assets/burger.webp', 4, 1, 1, 0, 0, 3, NULL),
  (2, 'Pulled Pork Nachos', 'Friday special', 9.99, NULL, '/assets/nachos.webp', 5, 1, 1, 1, 0, 4, NULL),
  -- Burgers & Sandwiches
  (3, 'Hamburger', 'Grilled patty with fresh toppings', 11.99, NULL, NULL, NULL, 1, 1, 0, 0, 1, NULL),
  (3, 'Double Burger', 'Two grilled patties', 13.99, NULL, NULL, NULL, 1, 1, 0, 0, 2, NULL),
  (3, 'Philly Cheesesteak', 'Shaved steak with melted cheese', 13.99, NULL, NULL, NULL, 1, 1, 0, 0, 3, NULL),
  (3, 'Chicken Sandwich / Wrap', 'Choice of crispy or grilled chicken', 13.99, NULL, NULL, NULL, 1, 1, 0, 0, 4, NULL),
  (3, 'Open-Faced Roast Beef Sandwich', 'Sliced roast beef over bread with savory gravy', 13.99, NULL, NULL, NULL, 1, 1, 0, 0, 5, NULL),
  (3, 'Add Cheese', 'Add-on for any burger or sandwich', 1.50, NULL, NULL, NULL, 1, 1, 0, 0, 6, NULL),
  (3, 'Add Bacon', 'Add-on for any burger or sandwich', 2.50, NULL, NULL, NULL, 1, 1, 0, 0, 7, NULL),
  -- Appetizers
  (4, 'Burnt End Nachos', 'House-smoked meat, melted cheese, and fresh toppings', 18.99, NULL, NULL, NULL, 1, 1, 1, 0, 1, NULL),
  (4, 'Pulled Pork Nachos', 'Tender pulled pork, cheese, and diced onions', 14.99, NULL, NULL, NULL, 1, 1, 0, 0, 2, NULL),
  (4, 'Cheesesteak Eggrolls', 'Crispy wrappers filled with seasoned steak and cheese', 12.99, NULL, NULL, NULL, 1, 1, 0, 0, 3, NULL),
  (4, 'Quesadilla', 'Grilled tortilla stuffed with melted cheese', 13.99, NULL, NULL, NULL, 1, 1, 0, 1, 4, NULL),
  (4, 'Fried Pickles', 'Crispy breaded pickle slices served with dipping sauce', 9.99, NULL, NULL, NULL, 1, 1, 0, 0, 5, NULL),
  (4, 'Tater Skins', 'Crispy potato skins topped with cheese and bacon', 9.99, NULL, NULL, NULL, 1, 1, 0, 1, 6, NULL),
  (4, 'Hot Pepper Cheese Bites / Jalapeño Poppers', 'Spicy, cheesy golden bites', 7.99, NULL, NULL, NULL, 1, 1, 0, 0, 7, NULL),
  (4, 'Queso & Chips', 'Warm queso with crispy tortilla chips', 7.99, NULL, NULL, NULL, 1, 1, 0, 1, 8, NULL),
  (4, 'Salsa & Chips', 'Fresh salsa with crispy tortilla chips', 7.99, NULL, NULL, NULL, 1, 1, 0, 1, 9, NULL),
  -- Bottled & Canned Beers
  (5, 'Domestic Lager', 'Bottled American lager', 3.50, 4.2, NULL, NULL, 1, 1, 0, 0, 1, 72),
  (5, 'Import Lager', 'Bottled Mexican-style lager, served with lime', 4.50, 4.5, NULL, NULL, 1, 1, 0, 0, 2, 60),
  (5, 'Hard Seltzer', 'Canned hard seltzer, variety of flavors', 4.50, 5.0, NULL, NULL, 1, 1, 0, 1, 3, 60),
  (5, 'Local Craft Can', 'Canned IPA from a regional Kansas brewery', 5.50, 6.5, NULL, NULL, 1, 1, 1, 0, 4, 36),
  -- House Cocktails
  (6, 'Whiskey Sour', 'Bourbon, fresh lemon, simple syrup', 7.00, 13.0, NULL, NULL, 1, 1, 0, 1, 1, NULL),
  (6, 'Rhythm Mule', 'House vodka, ginger beer, lime — our signature mixed special', 9.00, 10.0, NULL, NULL, 1, 1, 0, 1, 2, NULL),
  (6, 'Seasonal Sangria', 'Red wine, brandy, and rotating seasonal fruit', 8.00, 9.0, NULL, NULL, 1, 1, 0, 1, 3, NULL),
  (6, 'Bourbon Old Fashioned', 'Bourbon, bitters, orange, sugar', 9.50, 14.0, NULL, NULL, 1, 1, 0, 1, 4, NULL),
  -- Non-Alcoholic
  (7, 'Fountain Soda', 'Free refills', 2.50, 0.0, NULL, NULL, 1, 1, 0, 1, 1, NULL),
  (7, 'Iced Tea', 'Sweet or unsweet, free refills', 2.50, 0.0, NULL, NULL, 1, 1, 0, 1, 2, NULL),
  (7, 'Fresh Lemonade', 'Free refills', 2.75, 0.0, NULL, NULL, 1, 1, 0, 1, 3, NULL),
  (7, 'Coffee', 'Regular or decaf', 2.50, 0.0, NULL, NULL, 1, 1, 0, 1, 4, NULL);

-- Real weekly programming from the venue's own promo flyer (Open Mic
-- Wednesdays, Karaoke w/ DJ Big D Thursdays, Adults-Only Karaoke
-- Saturdays). Seeded as the next three occurrences of each — these are
-- the dated "Special Events" that surface in the /events hero and the
-- /calendar grid. The recurring Friday/Saturday house-band schedule
-- shown alongside them on /events is static copy, not DB-backed.
INSERT INTO events (title, description, event_date, start_time, cover_charge, image_url) VALUES
  ('Open Mic Night', 'All talent welcome — bring your guitar, your voice, or just come watch.', '2026-08-19', '19:00', 0.00, NULL),
  ('Karaoke Night with DJ Big D', 'You be the star! Karaoke hosted by DJ Big D.', '2026-08-20', '20:00', 0.00, '/assets/karaoke.webp'),
  ('Adults Only Karaoke Night', '18+ only, ID required. Sing your heart out.', '2026-08-22', '20:00', 0.00, '/assets/karaoke.webp'),
  ('Open Mic Night', 'All talent welcome — bring your guitar, your voice, or just come watch.', '2026-08-26', '19:00', 0.00, NULL),
  ('Karaoke Night with DJ Big D', 'You be the star! Karaoke hosted by DJ Big D.', '2026-08-27', '20:00', 0.00, '/assets/karaoke.webp'),
  ('Adults Only Karaoke Night', '18+ only, ID required. Sing your heart out.', '2026-08-29', '20:00', 0.00, '/assets/karaoke.webp'),
  ('Open Mic Night', 'All talent welcome — bring your guitar, your voice, or just come watch.', '2026-09-02', '19:00', 0.00, NULL),
  ('Karaoke Night with DJ Big D', 'You be the star! Karaoke hosted by DJ Big D.', '2026-09-03', '20:00', 0.00, '/assets/karaoke.webp'),
  ('Adults Only Karaoke Night', '18+ only, ID required. Sing your heart out.', '2026-09-05', '20:00', 0.00, '/assets/karaoke.webp');

INSERT INTO band_applications (band_name, genre, rate, email, media_link, status) VALUES
  ('The Wandering Embers', 'Folk rock', 250.00, 'embers@example.com', 'https://open.spotify.com/artist/example1', 'Pending'),
  ('Static Harbor', 'Surf punk', 300.00, 'staticharbor@example.com', 'https://youtube.com/@statichabor', 'Reviewed');
