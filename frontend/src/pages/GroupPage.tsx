import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { SendIcon, SparkleIcon } from '../components/Icons';
import { PlaceBadge } from '../components/PlaceBadge';
import { TopBar } from '../components/TopBar';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRecSession } from '../lib/session';
import type { ChatMessage, Group, Plan } from '../lib/types';
import { timeAgo } from '../lib/util';

/** Group profile + chat */
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

  if (error) return <div className="screen"><TopBar back="/profile" /><p className="error">{error}</p></div>;
  if (!group) return <div className="screen center muted">Loading…</div>;

  const current = group.activities[0];
  const budget = meta?.priceTiers.find((t) => t.id === group.budget)?.label;

  return (
    <div className={`screen group-page${tab === 'chat' ? ' with-composer' : ''}`}>
      <TopBar back="/profile" title={<strong>{group.name}</strong>} />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>
          Chat
        </button>
        <button role="tab" aria-selected={tab === 'profile'} className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>
          Group profile
        </button>
      </div>

      {current && (
        <div className="next-up">
          <PlaceBadge place={current.place} size={40} />
          <div>
            <span className="tiny muted">Latest plan</span>
            <strong>{current.place.name}</strong>
          </div>
          {current.byUserId !== me?.user.id && (
            <button type="button" className="btn btn--sm btn--ghost" onClick={joinCurrent}>
              I'm in
            </button>
          )}
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
                  {!m.mine && m.user && <Avatar user={m.user} size={30} />}
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
            <input className="input" placeholder={`Message ${group.name}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
            <button className="icon-btn icon-btn--filled" aria-label="Send" disabled={!text.trim()}>
              <SendIcon size={20} />
            </button>
          </form>
        </>
      ) : (
        <div className="group-profile">
          {group.status === 'forming' ? (
            <div className="notice">
              This crew is just for today's first stop. <button className="link" onClick={keep}>Make it official</button> to save a group profile.
            </div>
          ) : (
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={planNext}>
              <SparkleIcon size={20} /> Plan the next thing together
            </button>
          )}

          <section className="card">
            <h2 className="subhead">Members</h2>
            <ul className="crew__list">
              {group.members.map((m) => (
                <li key={m.id}>
                  <Avatar user={m} size={40} />
                  <div>
                    <strong>{m.id === me?.user.id ? 'You' : m.fullName}</strong>
                    <p className="small muted">{m.school ?? `@${m.username}`}</p>
                    {m.bio && <p className="small">{m.bio}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="subhead">What you have in common</h2>
            {group.sharedInterests.length ? (
              <ul className="common">
                {group.sharedInterests.slice(0, 8).map((s) => (
                  <li key={s.tag}>
                    <span className={`tag${s.everyone ? ' tag--all' : ''}`}>{s.tag}</span>
                    <span className="small muted">{s.everyone ? 'everyone' : s.who.join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Still figuring each other out. The algorithm will balance everyone's tastes.</p>
            )}
            <p className="small">
              <strong>Group budget:</strong> up to {budget}, so it works for everyone.
            </p>
          </section>

          <section className="card">
            <h2 className="subhead">Your day together</h2>
            <ul className="timeline">
              {group.activities.map((a, i) => (
                <li key={a.at + i}>
                  <PlaceBadge place={a.place} size={36} />
                  <div>
                    <strong>{a.place.name}</strong>
                    <p className="tiny muted">{timeAgo(a.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <p className="center">
            <Link to="#" onClick={(e) => { e.preventDefault(); leave(); }} className="small danger">
              Leave group
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
