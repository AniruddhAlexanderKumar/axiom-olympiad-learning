import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Clock3, Layers, Info, RotateCcw, ShieldCheck, Sparkles, Target, Timer, TriangleAlert } from 'lucide-react';
import { api, ApiError, postJson } from '../api.js';
import type { Bootstrap, PracticeMode, PracticeOverview, PracticeSession } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

const modes: { id: PracticeMode; title: string; detail: string; icon: typeof Target; tone: string; meta: string }[] = [
  { id: 'topic', title: 'Topic practice', detail: 'Focus on one topic. Feedback after every answer, with a hint before the solution.', icon: Target, tone: 'sage', meta: '5 questions · untimed' },
  { id: 'mixed', title: 'Mixed set', detail: 'Questions from across your unlocked topics, adapted to your current mastery.', icon: Layers, tone: 'blue', meta: '5 questions · untimed' },
  { id: 'timed', title: 'Timed challenge', detail: 'A short assessment. Answers are saved as you go and graded when you submit.', icon: Timer, tone: 'amber', meta: '6 questions · 8 minutes' },
  { id: 'mock', title: 'Mock examination', detail: 'A longer assessment over mixed topics. Results appear only after submission.', icon: BookOpenCheck, tone: 'plum', meta: '8 questions · 20 minutes' },
  { id: 'review', title: 'Review mistakes', detail: 'Revisit missed questions and anything spaced repetition says is due.', icon: RotateCcw, tone: 'rose', meta: 'Up to 5 questions · untimed' },
];

export default function PracticePage({ bootstrap }: { bootstrap: Bootstrap }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [mode, setMode] = useState<PracticeMode>('mixed');
  const [unitId, setUnitId] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<PracticeOverview>('/practice/overview').then((result) => {
      setOverview(result);
      const first = result.units.find((unit) => unit.unlocked);
      if (first) setUnitId((current) => current || first.id);
    }).catch(() => setOverview(null));
  }, []);

  const units = overview?.units ?? bootstrap.units.map((unit) => ({
    id: unit.id, title: unit.title, mastery: unit.mastery, lessonCount: unit.lessonCount,
    completedCount: unit.completedCount, unlocked: unit.lessons.some((lesson) => lesson.status !== 'locked'),
  }));
  const selectedUnit = units.find((unit) => unit.id === unitId);
  const selectedMode = modes.find((item) => item.id === mode) ?? modes[1];
  const reviewCount = bootstrap.stats.dueReviews;

  const start = async () => {
    setStarting(true);
    setError('');
    try {
      const payload: { mode: PracticeMode; unitId?: string } = { mode };
      if (mode === 'topic') payload.unitId = unitId;
      const result = await postJson('/practice/sessions', payload) as { session: PracticeSession };
      navigate(`/practice/session/${result.session.id}`);
    } catch (caught) {
      if (caught instanceof ApiError) setError(caught.message);
      else setError(caught instanceof Error ? caught.message : 'Practice could not be started.');
      setStarting(false);
    }
  };

  return (
    <div className="practice-page page-enter">
      <div className="page-heading practice-heading">
        <div>
          <span className="eyebrow">{bootstrap.competition.name.toUpperCase()} · PRACTICE ARENA</span>
          <h1>Practice with purpose</h1>
          <p>Every set is drawn from material you have unlocked. Choose the kind of thinking you want to work on today.</p>
        </div>
        {bootstrap.activePracticeSessionId
          ? <button className="button button-soft" type="button" onClick={() => navigate(`/practice/session/${bootstrap.activePracticeSessionId}`)}>Resume open session<ArrowRight size={14} /></button>
          : <span className="practice-heading-note"><ShieldCheck size={14} />Answers are checked on the server</span>}
      </div>

      <div className="practice-content-layout">
        <div>
          <div className="practice-mode-grid">
            {modes.map((item) => {
              const Icon = item.icon;
              const disabled = item.id === 'review' && reviewCount === 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`practice-mode-card practice-mode-${item.tone} ${mode === item.id ? 'practice-mode-selected' : ''} ${disabled ? 'practice-mode-disabled' : ''}`}
                  onClick={() => { setMode(item.id); setError(''); }}
                  aria-pressed={mode === item.id}
                  disabled={disabled}
                >
                  <div className="practice-mode-card-top">
                    <span className="mode-icon"><Icon size={16} /></span>
                    <span className="mode-radio"><i /></span>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.id === 'review' && reviewCount > 0 ? `${reviewCount} question${reviewCount === 1 ? '' : 's'} due for review right now.` : item.detail}</p>
                  <span className="practice-mode-meta">{item.meta}</span>
                </button>
              );
            })}
          </div>

          <div className="practice-lower-grid">
            <section className="practice-week-card">
              <div>
                <span className="eyebrow">YOUR WEEK</span>
                <h3>{bootstrap.week.filter((day) => day.active).length} active days, {bootstrap.week.reduce((sum, day) => sum + day.xp, 0)} XP</h3>
                <p>Practice questions count toward your daily goal and your streak. Difficulty adapts as your mastery estimate changes.</p>
                <button className="text-action" type="button" onClick={() => setMode('mixed')}>Build a mixed set<ArrowRight size={13} /></button>
              </div>
              <div className="practice-stat-ring"><span>{Math.round(bootstrap.stats.accuracy * 100)}%</span><small>ACCURACY</small></div>
            </section>
            <section className="practice-missed-card">
              <span className="practice-missed-icon"><RotateCcw size={16} /></span>
              <div>
                <span className="eyebrow">SPACED REVIEW</span>
                <strong>{reviewCount ? `${reviewCount} ready to revisit` : 'Nothing due yet'}</strong>
                <p>{reviewCount ? 'These questions are scheduled because they were missed or are due for reinforcement.' : 'Missed questions and previously solved ideas will appear here on a spaced schedule.'}</p>
              </div>
            </section>
          </div>
        </div>

        <aside className="practice-setup-panel">
          <span className="eyebrow">SET IT UP</span>
          <h2>{selectedMode.title}</h2>
          <p>{selectedMode.detail}</p>

          {mode === 'topic' && (
            <label className="field-label">Topic
              <select value={unitId} onChange={(event) => setUnitId(event.target.value)}>
                {units.filter((unit) => unit.unlocked).map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.title} · {Math.round(unit.mastery * 100)}% mastery</option>
                ))}
              </select>
            </label>
          )}

          <div className="practice-setup-summary">
            <div><SymbolIcon name="book-open" size={13} />{mode === 'topic' ? selectedUnit?.title ?? 'Choose a topic' : 'All unlocked topics'}</div>
            <div><Clock3 size={13} />{selectedMode.meta}</div>
            <div><Sparkles size={13} />Difficulty adapts to your mastery</div>
            <div><ShieldCheck size={13} />Original sample questions, not official papers</div>
          </div>

          {error && <div className="inline-alert practice-error-alert" role="alert"><TriangleAlert size={13} />{error}</div>}

          <button className="button button-primary practice-start-button" type="button" onClick={() => void start()} disabled={starting || (mode === 'topic' && !unitId)}>
            {starting ? 'Building your set…' : mode === 'review' ? 'Start review' : 'Start practice'}{!starting && <ArrowRight size={15} />}
          </button>
          <p className="practice-small-print"><Info size={12} />Mistakes are treated as information here. You can reattempt or revisit the explanation without losing progress.</p>
        </aside>
      </div>
    </div>
  );
}
