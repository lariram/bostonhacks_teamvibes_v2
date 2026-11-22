import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { FollowButton } from '../components/FollowButton';
import { ArrowIcon, PencilIcon, SendIcon } from '../components/Icons';
import { TypeTag } from '../components/PlaceBadge';
import { TopBar } from '../components/TopBar';
import { LineTimeline } from '../components/Transit';
import { crewLine, LINES } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRecSession } from '../lib/session';
import type { ChatMessage, Group, Plan } from '../lib/types';
import { timeAgo } from '../lib/util';

/** Group profile + chat. Every crew rides its own line color. */
export default function GroupPage() {
  const { id } = useParams();
  const { me, meta } = useAuth();
  const session = useRecSession();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'chat' | 'profile'>('chat');
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(() => api<ChatMessage[]>(`/groups/${id}/messages`).then(setMessages), [id]);

  useEffect(() => {
    api<Group>(`/groups/${id}`).then(setGroup).catch((e) => setError(e.message));
    loadMessages();
    const t = setInterval(loadMessages, 4000); // simple polling keeps the chat fresh
    return () => clearInterval(t);
  }, [id, loadMessages]);

  useEffect(() => {
    if (tab === 'chat') endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, tab]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = await api<ChatMessage>(`/groups/${id}/messages`, { body: { text } });
    setMessages((m) => [...m, msg]);
    setText('');
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name || name === group?.name) return setEditingName(false);
    setGroup(await api<Group>(`/groups/${id}`, { method: 'PATCH', body: { name } }));
    setEditingName(false);
    loadMessages();
  }

  async function keep() {
    setGroup(await api<Group>(`/groups/${id}/keep`, { body: {} }));
  }

  function planNext() {
    session.clear();
    navigate(`/discover?group=${id}`);
  }

  async function joinCurrent() {
    const plan = await api<Plan>(`/groups/${id}/join-current`, { method: 'POST' });
    navigate(`/plan/${plan.id}`);
  }

  async function leave() {
    if (!confirm(`Leave ${group?.name}?`)) return;
    await api(`/groups/${id}/leave`, { method: 'POST' });
    navigate('/profile', { replace: true });
  }

  if (error)
    return (
      <div className="screen">
        <TopBar back="/profile" />
        <p className="error">{error}</p>
      </div>
    );
  if (!group) return <div className="screen center muted">Loading…</div>;

  const current = group.activities[0];
  const budget = meta?.priceTiers.find((t) => t.id === group.budget)?.label;
  const color = LINES[crewLine(group.id)];

  return (
    <div className={`screen group-page${tab === 'chat' ? ' with-composer' : ''}`} style={{ '--crew': color } as CSSProperties}>
      <TopBar back="/profile" />
      <div className="crew-title">
        <span className="crew-title__bar" aria-hidden />
        <div>
          {editingName ? (
            <form className="crew-name-edit" onSubmit={saveName}>
              <input
                className="input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={40}
                autoFocus
                aria-label="Group name"
                onKeyDown={(e) => e.key === 'Escape' && setEditingName(false)}
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={!nameDraft.trim()}>
                Save
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditingName(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <h1 className="title title--sm crew-name">
              {group.name}
              <button
                type="button"
                className="icon-btn crew-name__edit"
                aria-label="Rename group"
                title="Rename group"
                onClick={() => {
                  setNameDraft(group.name);
                  setEditingName(true);
                }}
              >
                <PencilIcon size={16} />
              </button>
            </h1>
          )}
          <p className="small muted">
            {group.members.length} riders{current ? ` · last stop ${current.place.name}` : ''}
          </p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>
          Chat
        </button>
        <button role="tab" aria-selected={tab === 'profile'} className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>
          Crew profile
        </button>
      </div>

      {current && current.byUserId !== me?.user.id && (
        <div className="next-up">
          <span className="small">
            Next stop: <strong>{current.place.name}</strong>
          </span>
          <button type="button" className="btn btn--sm btn--primary" onClick={joinCurrent}>
            I'm in
          </button>
        </div>
      )}

      {tab === 'chat' ? (
        <>
          <ul className="chat">
            {messages.map((m) =>
              m.userId === 'system' ? (
                <li key={m.id} className="chat__system">
                  {m.text}
                </li>
              ) : (
                <li key={m.id} className={`chat__msg${m.mine ? ' mine' : ''}`}>
                  {!m.mine && m.user && <Avatar user={m.user} size={28} />}
                  <div>
                    {!m.mine && <span className="tiny muted">{m.user?.firstName}</span>}
                    <p className="bubble">{m.text}</p>
                    <span className="tiny muted">{timeAgo(m.at)}</span>
                  </div>
                </li>
              ),
            )}
            <div ref={endRef} />
          </ul>
          <form className="composer" onSubmit={send}>
            <input className="input" placeholder="Message the crew" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
            <button className="icon-btn icon-btn--filled" aria-label="Send" disabled={!text.trim()}>
              <SendIcon size={18} />
            </button>
          </form>
        </>
      ) : (
        <div className="group-profile">
          {group.status === 'forming' ? (
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={keep}>
              Make this crew official
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={planNext}>
              Plan the next stop together <ArrowIcon size={20} />
            </button>
          )}

          <section className="panel">
            <h2 className="label">Riders</h2>
            <ul className="people">
              {group.members.map((m) => (
                <li key={m.id}>
                  <Link to={m.id === me?.user.id ? '/profile' : `/people/${m.id}`} className="person-link">
                    <Avatar user={m} size={40} />
                    <div>
                      <strong>{m.id === me?.user.id ? 'You' : m.fullName}</strong>
                      <p className="small muted">{m.school ?? `@${m.username}`}</p>
                      {m.bio && <p className="small">{m.bio}</p>}
                    </div>
                  </Link>
                  {m.id !== me?.user.id && <FollowButton userId={m.id} initial={!!me?.user.following?.includes(m.id)} />}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2 className="label">What you share</h2>
            {group.sharedInterests.length ? (
              <ul className="shared">
                {group.sharedInterests.slice(0, 8).map((s) => (
                  <li key={s.tag}>
                    <span className={`tag${s.everyone ? ' tag--all' : ''}`}>{s.tag}</span>
                    <span className="small muted">
                      {s.everyone ? 'everyone' : s.whoIds.map((uid, i) => (uid === me?.user.id ? 'You' : s.who[i])).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Still getting to know each other. Picks will balance everyone's tastes.</p>
            )}
            <p className="small">
              <span className="muted">Crew budget</span> up to {budget}, so it works for everyone.
            </p>
          </section>

          <section className="panel">
            <h2 className="label">Your day together</h2>
            <LineTimeline
              items={group.activities}
              color={color}
              isCurrent={(a) => a === group.activities[0]}
              render={(a) => (
                <div className="stop-link">
                  <TypeTag type={a.place.type} />
                  <strong className="stop-link__name">{a.place.name}</strong>
                  <span className="tiny muted">{timeAgo(a.at)}</span>
                </div>
              )}
            />
          </section>

          <p className="center">
            <button type="button" className="link danger small" onClick={leave}>
              Leave crew
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
