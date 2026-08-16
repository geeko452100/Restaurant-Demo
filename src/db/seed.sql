-- Demo seed data for local/remote D1. Run via `npm run db:seed:local` or
-- `npm run db:seed:remote` after applying migrations.

INSERT INTO menu_categories (id, name, display_order, image_url) VALUES
  (1, 'Live on Tap', 1, '/assets/beer.jpg'),
  (2, 'Lunch Specials', 2, NULL);

INSERT INTO menu_items (category_id, name, description, price, abv, image_url, day_of_week, is_available, is_local, is_gluten_free, display_order) VALUES
  (1, 'Rhythm Pale Ale', 'American Pale Ale', 7.00, 5.4, NULL, NULL, 1, 1, 0, 1),
  (1, 'Brews Brothers Stout', 'Oatmeal Stout', 7.50, 6.1, NULL, NULL, 1, 1, 0, 2),
  (1, 'Backbeat IPA', 'West Coast IPA', 8.00, 6.8, NULL, NULL, 1, 1, 0, 3),
  (1, 'Encore Wheat', 'Hefeweizen', 7.00, 4.9, NULL, NULL, 0, 0, 0, 4),
  (1, 'Downbeat Lager', 'Vienna Lager', 7.00, 5.0, NULL, NULL, 1, 1, 0, 5),
  (1, 'Solo Sour', 'Berliner Weisse', 7.50, 4.2, NULL, NULL, 1, 0, 1, 6),
  -- Real weekly lunch specials from the venue's own promo flyer.
  -- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
  (2, 'Chicken Salad Sandwich', 'Tuesday special · served with fresh chips', 8.99, NULL, '/assets/food-chicken-salad-sandwich.jpg', 2, 1, 0, 0, 1),
  (2, 'Wrap Wednesday', 'Any wrap, served with fresh chips', 8.99, NULL, '/assets/food-wrap.jpg', 3, 1, 0, 0, 2),
  (2, 'Hamburger Special', 'Thursday special · served with fresh chips', 8.99, NULL, '/assets/food-burger.jpg', 4, 1, 0, 0, 3),
  (2, 'Pulled Pork Nachos', 'Friday special', 9.99, NULL, '/assets/food-pulled-pork-nachos.jpg', 5, 1, 1, 0, 4);

-- Real weekly programming from the venue's own promo flyer (Open Mic
-- Wednesdays, Karaoke w/ DJ Big D Thursdays, Adults-Only Karaoke
-- Saturdays). Seeded as the next three occurrences of each.
INSERT INTO events (title, description, event_date, start_time, cover_charge, image_url) VALUES
  ('Open Mic Night', 'All talent welcome — bring your guitar, your voice, or just come watch.', '2026-08-19', '19:00', 0.00, NULL),
  ('Karaoke Night with DJ Big D', 'You be the star! Karaoke hosted by DJ Big D.', '2026-08-20', '20:00', 0.00, '/assets/karaoke.jpg'),
  ('Adults Only Karaoke Night', '18+ only, ID required. Sing your heart out.', '2026-08-22', '20:00', 0.00, '/assets/karaoke.jpg'),
  ('Open Mic Night', 'All talent welcome — bring your guitar, your voice, or just come watch.', '2026-08-26', '19:00', 0.00, NULL),
  ('Karaoke Night with DJ Big D', 'You be the star! Karaoke hosted by DJ Big D.', '2026-08-27', '20:00', 0.00, '/assets/karaoke.jpg'),
  ('Adults Only Karaoke Night', '18+ only, ID required. Sing your heart out.', '2026-08-29', '20:00', 0.00, '/assets/karaoke.jpg'),
  ('Open Mic Night', 'All talent welcome — bring your guitar, your voice, or just come watch.', '2026-09-02', '19:00', 0.00, NULL),
  ('Karaoke Night with DJ Big D', 'You be the star! Karaoke hosted by DJ Big D.', '2026-09-03', '20:00', 0.00, '/assets/karaoke.jpg'),
  ('Adults Only Karaoke Night', '18+ only, ID required. Sing your heart out.', '2026-09-05', '20:00', 0.00, '/assets/karaoke.jpg');

INSERT INTO band_applications (band_name, genre, rate, email, media_link, status) VALUES
  ('The Wandering Embers', 'Folk rock', 250.00, 'embers@example.com', 'https://open.spotify.com/artist/example1', 'pending'),
  ('Static Harbor', 'Surf punk', 300.00, 'staticharbor@example.com', 'https://youtube.com/@statichabor', 'approved');
