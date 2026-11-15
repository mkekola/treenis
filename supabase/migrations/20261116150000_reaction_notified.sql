-- Reaktiosta ilmoitetaan vain kerran per kaveri per treeni: reaktion vaihto (🔥 → 🎉) ei
-- lähetä uutta ilmoitusta. react() päivittää vain reaktion ja ajan, joten merkintä säilyy.

alter table public.reactions add column notified_at timestamptz;
