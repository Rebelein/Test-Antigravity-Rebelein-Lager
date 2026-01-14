-- Release 0.0.46 Changelog
INSERT INTO public.changelogs (version, changes, active)
VALUES (
  '0.0.46',
  '[
    {"type": "fix", "text": "Fehler behoben, durch den Eingabefelder beim Erstellen von Kommissionen blockiert waren."},
    {"type": "fix", "text": "Absturz (Endlosschleife) beim Öffnen des Kommissions-Modals behoben."},
    {"type": "feature", "text": "Neue Kommissionen aus dem Dashboard werden nun automatisch zum Etikettendruck vorgemerkt."}
  ]'::jsonb,
  true
);
