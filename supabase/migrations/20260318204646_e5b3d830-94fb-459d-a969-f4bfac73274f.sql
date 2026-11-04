INSERT INTO app_settings (key, value) VALUES 
  ('financial_password', 'PLACEHOLDER'),
  ('reports_password', 'PLACEHOLDER')
ON CONFLICT DO NOTHING;