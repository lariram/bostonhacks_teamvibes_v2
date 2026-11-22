import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chip, ChipSection } from '../components/Chip';
import { TopBar } from '../components/TopBar';
import { LineDot } from '../components/Transit';
import { TYPE_LINE } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { PlaceType, Preferences, SelfUser } from '../lib/types';

const SECTIONS: { key: PlaceType; title: string }[] = [
  { key: 'food', title: 'Food' },
  { key: 'event', title: 'Events' },
  { key: 'activity', title: 'Activities' },
];

/** "Choose Preferences": also reused from the profile tab to edit interests */
export default function Onboarding() {
  const { meta, me, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get('edit') === '1';
  const [prefs, setPrefs] = useState<Preferences>(me?.user.preferences ?? { food: [], event: [], activity: [] });
  const [busy, setBusy] = useState(false);
  const max = meta?.maxPrefsPerCategory ?? 3;
  const done = () => navigate(editing ? '/profile' : '/discover', { replace: true });
  const total = prefs.food.length + prefs.event.length + prefs.activity.length;

  function toggle(cat: PlaceType, tag: string) {
    const cur = prefs[cat];
    if (cur.includes(tag)) setPrefs({ ...prefs, [cat]: cur.filter((t) => t !== tag) });
    else if (cur.length < max) setPrefs({ ...prefs, [cat]: [...cur, tag] });
  }

  async function save() {
    setBusy(true);
    try {
      const { user } = await api<{ user: SelfUser }>('/me/preferences', { method: 'PUT', body: prefs });
      setUser(user);
      done();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen with-footer">
      {editing && <TopBar back="/profile" />}
      <p className="label">{editing ? 'Your interests' : 'Step 1 of 1'}</p>
      <h1 className="title">What are you into?</h1>
      <p className="lede">Pick up to {max} of each. We use these to choose for you, and to find people who like the same things.</p>
      {meta &&
        SECTIONS.map(({ key, title }) => (
          <ChipSection
            key={key}
            title={title}
            aside={
              <span className="label label--muted section-count">
                <LineDot line={TYPE_LINE[key]} size={8} /> {prefs[key].length}/{max}
              </span>
            }
          >
            {meta.preferenceTags[key].map((tag) => {
              const on = prefs[key].includes(tag);
              return (
                <Chip key={tag} selected={on} disabled={!on && prefs[key].length >= max} onClick={() => toggle(key, tag)}>
                  {tag}
                </Chip>
              );
            })}
          </ChipSection>
        ))}
      <footer className="footer-bar">
        <button type="button" className="btn btn--ghost" onClick={done}>
          {editing ? 'Cancel' : 'Skip'}
        </button>
        <button type="button" className="btn btn--primary btn--grow" onClick={save} disabled={busy}>
          {editing ? 'Save' : total ? `Continue with ${total}` : 'Continue'}
        </button>
      </footer>
    </div>
  );
}
