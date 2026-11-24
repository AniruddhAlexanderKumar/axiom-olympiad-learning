import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, ChevronRight, Lightbulb, LockKeyhole, MessageCircleQuestion, RotateCcw, Send, ShieldCheck, Sparkles, Target, X } from 'lucide-react';
import { api, postJson } from '../api.js';
import type { Bootstrap, TutorMessage } from '../types.js';

const starterPrompts = [
  { label: 'Explain this in simpler terms', text: 'Explain the current lesson in simpler terms, with a small concrete example.' },
  { label: 'I’m stuck on a problem', text: 'I am stuck on the last problem I missed. Give me a hint, not the full solution.' },
  { label: 'What should I revise?', text: 'What should I revise next, based on my weakest topic?' },
  { label: 'Give me another problem', text: 'Give me another practice question for my weakest topic.' },
];

export default function TutorPage({ bootstrap }: { bootstrap: Bootstrap }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLesson = searchParams.get('lesson') ?? '';
  const lesson = bootstrap.units.flatMap((unit) => unit.lessons).find((item) => item.id === requestedLesson);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ messages: TutorMessage[] }>('/tutor/history')
      .then((payload) => setMessages(payload.messages))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError('');
    const optimistic: TutorMessage = { id: -Date.now(), role: 'student', content: message, lessonId: lesson?.id ?? null, createdAt: new Date().toISOString() };
    setMessages((old) => [...old, optimistic]);
    setInput('');
    try {
      const payload = await postJson('/tutor/chat', { message, ...(lesson ? { lessonId: lesson.id } : {}) }) as { message: TutorMessage };
      setMessages((old) => [...old, payload.message]);
    } catch (caught) {
      setMessages((old) => old.filter((item) => item.id !== optimistic.id));
      setError(caught instanceof Error ? caught.message : 'The tutor could not reply.');
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const weakest = [...bootstrap.units].filter((unit) => unit.lessonCount > 0).sort((left, right) => left.mastery - right.mastery)[0];
  const weakestLesson = weakest?.lessons.find((item) => item.status === 'available' || item.status === 'in_progress');

  return (
    <div className="tutor-page page-enter">
      <div className="page-heading tutor-page-heading">
        <div>
          <span className="eyebrow">AI TUTOR · {bootstrap.competition.name.toUpperCase()}</span>
          <h1>A tutor that waits for your thinking</h1>
          <p>Hints before answers. It reads your recent mistakes and mastery estimates to keep help relevant — never to hand you the solution early.</p>
        </div>
        <span className="tutor-privacy-pill"><ShieldCheck size={14} />Uses only your own learning history</span>
      </div>

      <div className="tutor-layout">
        <section className="tutor-chat-panel">
          <header className="tutor-chat-head">
            <span className="tutor-avatar"><Sparkles size={17} /></span>
            <div>
              <strong>Study tutor</strong>
              <span><i className="tutor-online-dot" />Adaptive guidance · not an answer key</span>
            </div>
            {lesson && (
              <button className="tutor-context-reset" type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('lesson'); setSearchParams(next, { replace: true }); }}>
                <X size={11} />Clear lesson context
              </button>
            )}
          </header>

          <div className="tutor-context-strip">
            <span className="context-chip context-chip-course"><BookOpenCheck size={11} />{bootstrap.competition.name}</span>
            {lesson
              ? <span className="context-chip"><BookOpenCheck size={11} />{lesson.title}</span>
              : <span className="context-chip"><Target size={11} />Next unlocked lesson</span>}
            <span className="context-chip"><Lightbulb size={11} />Weakest: {weakest?.shortTitle ?? 'not enough data'}</span>
          </div>

          <div className="tutor-message-list">
            {loading ? (
              <div className="tutor-empty-loading"><span className="button-spinner" />Opening your conversation…</div>
            ) : messages.length === 0 ? (
              <div className="tutor-welcome">
                <span className="tutor-welcome-mark"><Sparkles size={18} /></span>
                <span className="eyebrow">START WHERE YOU ARE</span>
                <h2>What would you like to understand?</h2>
                <p>Ask about a concept, a mistake, or what to revise. The tutor will give you one useful next step rather than the whole answer.</p>
                <div className="tutor-starter-prompts">
                  {starterPrompts.map((prompt) => (
                    <button key={prompt.label} type="button" onClick={() => void send(prompt.text)} disabled={sending}>
                      <MessageCircleQuestion size={13} />{prompt.label}<ChevronRight size={12} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="tutor-messages">
                {messages.map((message) => (
                  <div key={`${message.id}-${message.createdAt}`} className={`tutor-message ${message.role === 'student' ? 'tutor-message-student' : ''}`}>
                    <span className={`message-avatar ${message.role === 'tutor' ? 'message-avatar-tutor' : ''}`}>{message.role === 'tutor' ? <Sparkles size={12} /> : bootstrap.user.fullName.trim().charAt(0).toUpperCase()}</span>
                    <div className="message-body">
                      <div className="message-sender">{message.role === 'tutor' ? 'Study tutor' : 'You'}<span>{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}</span></div>
                      {message.content.split('\n\n').map((paragraph, paragraphIndex) => <p key={`${message.id}-${paragraphIndex}`}>{paragraph}</p>)}
                    </div>
                  </div>
                ))}
                {sending && <div className="tutor-typing"><span className="message-avatar message-avatar-tutor"><Sparkles size={12} /></span><span><i /><i /><i /></span><small>Finding a useful next step…</small></div>}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {error && <div className="tutor-error"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

          {messages.length > 0 && (
            <div className="tutor-quick-prompts">
              {starterPrompts.map((prompt) => <button key={prompt.label} type="button" onClick={() => void send(prompt.text)} disabled={sending}>{prompt.label}</button>)}
            </div>
          )}

          <form className="tutor-composer" onSubmit={submit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input); } }}
              placeholder={lesson ? `Ask about “${lesson.title}”…` : 'Ask about a concept, a mistake, or what to revise…'}
              maxLength={1000}
              rows={2}
              aria-label="Message the study tutor"
            />
            <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
            <button className="composer-send" type="submit" disabled={!input.trim() || sending} aria-label="Send message"><Send size={15} /></button>
          </form>
          <div className="tutor-chat-foot"><LockKeyhole size={11} />Private to your study space · replies are heuristic, not a model API</div>
        </section>

        <aside className="tutor-side-panel">
          <section className="tutor-side-intro">
            <span className="eyebrow">HOW THIS TUTOR HELPS</span>
            <h3>Hints first, reasoning second.</h3>
            <p>It identifies the likely misunderstanding, gives one useful step, and invites another attempt. The full solution comes after you have tried again.</p>
          </section>
          <div className="tutor-help-steps">
            <div><span>01</span><div><strong>Concept, in smaller pieces</strong><small>Definitions tied to the lesson you are on.</small></div></div>
            <div><span>02</span><div><strong>A hint, not the answer</strong><small>Your first attempt stays yours.</small></div></div>
            <div><span>03</span><div><strong>Mistake analysis</strong><small>Based on the questions you actually missed.</small></div></div>
            <div><span>04</span><div><strong>What to revise next</strong><small>Ranked by your mastery estimates.</small></div></div>
            <div><span>05</span><div><strong>More practice</strong><small>One fresh prompt for the weakest topic.</small></div></div>
          </div>
          <section className="tutor-revision-card">
            <span className="tutor-revision-icon"><Target size={15} /></span>
            <span className="eyebrow">SUGGESTED FOCUS</span>
            <strong>{weakest ? `${weakest.title} · ${Math.round(weakest.mastery * 100)}% mastery` : 'Finish a lesson to unlock guidance'}</strong>
            <p>{weakestLesson ? `“${weakestLesson.title}” is the next unpublished gap in this topic.` : 'Ask for a revision plan and the tutor will use your recent accuracy.'}</p>
            {weakestLesson
              ? <Link to={`/lesson/${weakestLesson.id}`}>Open lesson<ArrowRight size={12} /></Link>
              : <button type="button" onClick={() => void send(starterPrompts[2].text)} disabled={sending}>Ask for a plan<ArrowRight size={12} /></button>}
          </section>
          <div className="tutor-transparency">
            <ShieldCheck size={14} />
            <p>No external AI service is called. Replies are generated from your curriculum and activity data inside this app, and are scoped to your account.</p>
          </div>
          <button className="button button-secondary full-width" type="button" onClick={() => setSearchParams({}, { replace: true })} disabled={!lesson}>
            <RotateCcw size={13} />Reset to current lesson
          </button>
        </aside>
      </div>
    </div>
  );
}
