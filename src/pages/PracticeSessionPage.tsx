import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Info, Lightbulb, RotateCcw, Send, TriangleAlert, X } from 'lucide-react';
import { api, postJson } from '../api.js';
import type { Bootstrap, PracticeMode, PracticeResult, PracticeSession, Question } from '../types.js';

type Feedback = { correct: boolean; feedback: string; hint?: string; explanation?: string; correctAnswer?: string; xpAwarded: number };

const modeNames: Record<PracticeMode, string> = {
  topic: 'Topic practice',
  mixed: 'Mixed set',
  timed: 'Timed challenge',
  review: 'Review mistakes',
  mock: 'Mock examination',
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function parseAnswerSet(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* Fall back to comma-separated values. */ }
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

function QuestionBody({ question, answer, setAnswer, disabled }: {
  question: Question;
  answer: string;
  setAnswer: (value: string) => void;
  disabled: boolean;
}) {
  if (question.type === 'single_choice') {
    return (
      <div className="choice-list practice-choice-list" role="radiogroup" aria-label="Answer choices">
        {question.choices.map((choice) => (
          <button
            type="button"
            key={choice.value}
            className={`choice-button ${answer === choice.value ? 'choice-selected' : ''}`}
            aria-pressed={answer === choice.value}
            onClick={() => setAnswer(choice.value)}
            disabled={disabled}
          >
            <span className="choice-key">{choice.value}</span><span>{choice.label}</span>
            {answer === choice.value && <span className="choice-check"><Check size={15} /></span>}
          </button>
        ))}
      </div>
    );
  }
  if (question.type === 'multiple_select') {
    const selected = parseAnswerSet(answer);
    return (
      <div className="choice-list practice-choice-list" role="group" aria-label="Select all answers that apply">
        {question.choices.map((choice) => {
          const isSelected = selected.includes(choice.value);
          return (
            <button
              type="button"
              key={choice.value}
              className={`choice-button ${isSelected ? 'choice-selected' : ''}`}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => {
                const next = new Set(selected);
                if (next.has(choice.value)) next.delete(choice.value); else next.add(choice.value);
                setAnswer(JSON.stringify(question.choices.filter((item) => next.has(item.value)).map((item) => item.value)));
              }}
            >
              <span className="choice-key">{choice.value}</span><span>{choice.label}</span>
              {isSelected && <span className="choice-check"><Check size={15} /></span>}
            </button>
          );
        })}
      </div>
    );
  }
  if (question.type === 'proof' || question.type === 'short_answer') {
    return (
      <label className="answer-field-label">{question.type === 'proof' ? 'Your working' : 'Your answer'}
        <textarea className="proof-answer-input" rows={5} maxLength={300} value={answer} disabled={disabled} onChange={(event) => setAnswer(event.target.value)} placeholder={question.type === 'proof' ? 'Explain each step and why it follows…' : 'Write a concise response…'} />
      </label>
    );
  }
  return (
    <label className="answer-field-label">Your answer
      <div className="number-answer-wrap">
        <input type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={answer} disabled={disabled} onChange={(event) => setAnswer(event.target.value)} placeholder="Type a number or fraction" />
        <span>NUMBER</span>
      </div>
    </label>
  );
}

function Results({ result, mode, onRetry }: { result: PracticeResult; mode: PracticeMode; onRetry: () => void }) {
  const percent = Math.round(result.accuracy * 100);
  const weak = result.topicPerformance.filter((topic) => topic.accuracy < 0.7);
  return (
    <div className="practice-results-page page-enter">
      <div className="results-topline">
        <Link className="text-action" to="/practice"><ChevronLeft size={14} /> Back to practice</Link>
        <span><Clock3 size={13} />{Math.floor(result.timeTakenSeconds / 60)}m {result.timeTakenSeconds % 60}s</span>
      </div>
      <section className="results-hero">
        <div className="results-score-ring" style={{ ['--score' as string]: `${percent}%` }}>
          <div><strong>{percent}<small>%</small></strong><span>ACCURACY</span></div>
        </div>
        <div className="results-hero-copy">
          <span className="eyebrow">{modeNames[mode]} · COMPLETE</span>
          <h1>{percent >= 80 ? 'That is strong, reliable work.' : percent >= 50 ? 'A useful set of information.' : 'A clear place to begin.'}</h1>
          <p>
            You solved {result.correctCount} of {result.questionCount} questions.
            {weak.length ? ` ${weak.map((topic) => topic.unitTitle).join(' and ')} could use another pass.` : ' No topic fell below the review threshold.'}
          </p>
          <div className="results-rewards">
            <span><ArrowUpRight size={13} />+{result.xpAwarded} XP earned</span>
            {weak.length === 0 && <span><CheckCircle2 size={13} />No weak topics in this set</span>}
          </div>
        </div>
      </section>

      <div className="results-grid">
        <div className="results-review-list">
          <div className="results-section-heading"><div><span className="eyebrow">QUESTION BY QUESTION</span><h2>What happened, and why</h2></div><span>{result.questionCount} reviewed</span></div>
          {result.results.map((item, index) => (
            <article className="result-question" key={item.question.id}>
              <div className="result-question-top">
                <span className={`result-status-icon ${item.correct ? 'result-status-correct' : 'result-status-incorrect'}`}>{item.correct ? <Check size={13} /> : <X size={13} />}</span>
                QUESTION {String(index + 1).padStart(2, '0')}
                <span className="result-topic-tag">{item.unitTitle}</span>
              </div>
              <h3>{item.question.prompt}</h3>
              <div className="result-answer-row">
                <span>Your answer</span><strong>{item.yourAnswer ?? 'Not answered'}</strong>
                {item.correct
                  ? <span className="result-correct-label">Correct</span>
                  : <span className="result-answer-correct">Answer: {item.correctAnswer}</span>}
              </div>
              <div className="result-explanation"><span>Why it works</span><p>{item.explanation}</p></div>
            </article>
          ))}
        </div>
        <aside className="results-side-panel">
          <section className="results-topic-card">
            <span className="eyebrow">BY TOPIC</span>
            <h3>{weak.length ? `${weak[0].unitTitle} deserves the next session` : 'Even performance across topics'}</h3>
            {result.topicPerformance.map((topic) => (
              <div className="result-topic-row" key={topic.unitId}>
                <div><strong>{topic.unitTitle}</strong><span>{topic.correct}/{topic.count} correct</span></div>
                <span className={`result-topic-score ${topic.accuracy >= 0.7 ? 'result-topic-good' : ''}`}>{Math.round(topic.accuracy * 100)}%</span>
                <div className="topic-progress-track"><span style={{ width: `${Math.round(topic.accuracy * 100)}%` }} /></div>
              </div>
            ))}
            {result.recommendations.length > 0 && (
              <div className="revision-recommendation"><Lightbulb size={13} /><span>Revise {result.recommendations.join(', ')} before your next timed set.</span></div>
            )}
          </section>
          <section className="results-actions-card">
            <span className="eyebrow">KEEP GOING</span>
            <button className="button button-primary" type="button" onClick={onRetry}><RotateCcw size={14} /> Practise again</button>
            <Link className="button button-secondary" to="/journey">Back to journey<ArrowRight size={14} /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function PracticeSessionPage({ bootstrap, refresh }: { bootstrap: Bootstrap; refresh: () => Promise<unknown> }) {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<PracticeResult | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api<{ session: PracticeSession }>(`/practice/sessions/${encodeURIComponent(sessionId)}`)
      .then((payload) => {
        if (cancelled) return;
        setSession(payload.session);
        setAnswers(payload.session.answers);
        setResult(payload.session.score);
        startedAtRef.current = new Date(payload.session.startedAt).getTime() || Date.now();
      })
      .catch((caught) => { if (!cancelled) setLoadError(caught instanceof Error ? caught.message : 'This session could not be opened.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  const isAssessment = session?.mode === 'timed' || session?.mode === 'mock';
  const timeLimit = session?.timeLimitSeconds ?? 0;
  const elapsed = Math.max(0, Math.floor((now - startedAtRef.current) / 1000));
  const remaining = timeLimit ? Math.max(0, timeLimit - elapsed) : 0;
  const expired = Boolean(timeLimit) && remaining === 0;

  useEffect(() => {
    if (!timeLimit || result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [timeLimit, result]);

  const question = session?.questions[index];
  const answeredIds = useMemo(() => new Set(Object.entries(answers).filter(([, value]) => value.trim()).map(([id]) => id)), [answers]);
  const currentAnswer = question ? answers[question.id] ?? '' : '';

  const setAnswer = (value: string) => {
    if (!question) return;
    setAnswers((old) => ({ ...old, [question.id]: value }));
    setFeedback((old) => { const next = { ...old }; delete next[question.id]; return next; });
  };

  const saveAssessmentAnswer = useCallback(async (questionId: string, value: string) => {
    if (!session) return;
    try {
      await postJson(`/practice/sessions/${session.id}/answer`, { questionId, answer: value });
    } catch { /* A late answer after the timer is discarded; submission still grades saved answers. */ }
  }, [session]);

  const checkAnswer = async () => {
    if (!question || !currentAnswer.trim()) { setError('Choose or enter an answer first.'); return; }
    setSaving(true); setError('');
    try {
      const response = await postJson(`/practice/sessions/${session!.id}/answer`, { questionId: question.id, answer: currentAnswer }) as Feedback & { saved: boolean };
      setFeedback((old) => ({ ...old, [question.id]: response }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That answer could not be checked.');
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!session) return;
    setSubmitting(true); setError(''); setConfirming(false);
    try {
      if (isAssessment) {
        await Promise.all(Object.entries(answers).filter(([, value]) => value.trim()).map(([questionId, value]) => saveAssessmentAnswer(questionId, value)));
      }
      const payload = await postJson(`/practice/sessions/${session.id}/submit`, {}) as { result: PracticeResult };
      setResult(payload.result);
      await refresh().catch(() => undefined);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This session could not be submitted.');
    } finally { setSubmitting(false); }
  };

  useEffect(() => {
    if (!expired || !isAssessment || result || submitting) return;
    setConfirming(false);
    void submit();
    // The timer expiring is the only trigger; submit reads current answers through the closure on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (loading) return <div className="practice-loading"><span className="button-spinner" />Opening your practice set…</div>;
  if (!session || !question) {
    return (
      <div className="lesson-error"><span><TriangleAlert size={18} /></span><h2>We couldn’t open this practice set</h2><p>{loadError || 'It may have been completed already.'}</p><Link className="button button-primary" to="/practice">Back to practice<ArrowRight size={15} /></Link></div>
    );
  }
  if (result) return <Results result={result} mode={session.mode} onRetry={() => navigate('/practice')} />;

  const currentFeedback = feedback[question.id];
  const maxIndex = session.questions.length;

  const next = () => setIndex((value) => Math.min(maxIndex - 1, value + 1));
  const previous = () => setIndex((value) => Math.max(0, value - 1));

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (isAssessment) { void saveAssessmentAnswer(question.id, currentAnswer); next(); return; }
    if (!currentFeedback) { void checkAnswer(); return; }
    next();
  };

  return (
    <div className="practice-session-page page-enter">
      <div className="practice-session-header">
        <button className="text-action" type="button" onClick={() => navigate('/practice')}><ChevronLeft size={14} /> Practice</button>
        <span className="practice-session-type">
          <Clock3 size={14} />{modeNames[session.mode]}
          <small>{isAssessment ? 'Graded on submit' : 'Feedback as you go'} · {bootstrap.competition.name}</small>
        </span>
        {timeLimit > 0 && <div className={`practice-countdown ${remaining <= 60 ? 'timer-warning' : ''}`}><Clock3 size={13} />{formatTime(remaining)}</div>}
      </div>

      <div className="practice-session-layout">
        <main className="practice-question-area">
          <div className="practice-session-progress">
            <div><span>QUESTION {index + 1} OF {session.questions.length}</span><strong>{question.unitTitle}{question.lessonTitle ? ` · ${question.lessonTitle}` : ''}</strong></div>
            <div className="assessment-progress-track"><span style={{ width: `${(answeredIds.size / session.questions.length) * 100}%` }} /></div>
            <small>{answeredIds.size} answered{question.everCorrect ? ' · solved before' : ''}</small>
          </div>

          <form className="practice-question-card" onSubmit={submitForm}>
            <div className="practice-question-top">
              <span className="question-label"><span className="question-number">{String(index + 1).padStart(2, '0')}</span> YOUR TURN</span>
              <span className="difficulty-dots" aria-label={`Difficulty ${question.difficulty} of 5`}>{Array.from({ length: 5 }, (_, dot) => <i key={dot} className={dot < question.difficulty ? 'difficulty-on' : ''} />)}</span>
            </div>
            <h2>{question.prompt}</h2>
            <span className="practice-question-context">{question.objective}<span>·</span>{question.unitTitle}</span>

            <QuestionBody question={question} answer={currentAnswer} setAnswer={(value) => { setAnswer(value); if (isAssessment) void saveAssessmentAnswer(question.id, value); }} disabled={submitting || (isAssessment && expired)} />

            {currentFeedback && (
              <div className={`answer-feedback ${currentFeedback.correct ? 'answer-feedback-correct' : 'answer-feedback-hint'}`} role="status">
                <div className="feedback-heading">
                  {currentFeedback.correct ? <CheckCircle2 size={17} /> : <Lightbulb size={17} />}
                  <strong>{currentFeedback.feedback}</strong>
                  {currentFeedback.xpAwarded > 0 && <span className="feedback-xp">+{currentFeedback.xpAwarded} XP</span>}
                </div>
                {!currentFeedback.correct && currentFeedback.hint && <p className="feedback-hint">Hint: {currentFeedback.hint}</p>}
                {currentFeedback.explanation && (
                  <div className="feedback-explanation">
                    <span>{currentFeedback.correct ? 'Why it works' : `The answer is ${currentFeedback.correctAnswer}`}</span>
                    <p>{currentFeedback.explanation}</p>
                  </div>
                )}
              </div>
            )}

            {isAssessment && <div className="assessment-hint-bar"><Info size={13} />Your answer is saved as you choose. You will see the explanations after you submit.</div>}
            {error && <p className="question-inline-error"><AlertCircle size={14} />{error}</p>}

            <div className="practice-session-footer">
              <button className="button button-secondary" type="button" onClick={previous} disabled={index === 0}><ChevronLeft size={14} /> Previous</button>
              <div className="practice-session-footer-actions">
                {index < maxIndex - 1 ? (
                  <button className="button button-primary" type="submit" disabled={saving || (isAssessment && expired)}>
                    {isAssessment ? 'Save & next' : currentFeedback ? 'Next question' : saving ? 'Checking…' : 'Check answer'}
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button className="button button-primary" type="button" onClick={() => setConfirming(true)} disabled={submitting}>
                    <Send size={14} />{submitting ? 'Submitting…' : 'Submit set'}
                  </button>
                )}
              </div>
            </div>
            {index < maxIndex - 1 && <button className="text-action practice-submit-early" type="button" onClick={() => setConfirming(true)}>Finish this set now</button>}
          </form>
        </main>

        <aside className="practice-question-nav">
          <div className="question-nav-heading"><div><span className="eyebrow">SET MAP</span><h3>{answeredIds.size} of {session.questions.length} answered</h3></div><Clock3 size={15} /></div>
          <div className="question-nav-grid">
            {session.questions.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(itemIndex)}
                className={`${itemIndex === index ? 'question-nav-current' : ''} ${answeredIds.has(item.id) && itemIndex !== index ? 'question-nav-answered' : ''}`}
                aria-label={`Question ${itemIndex + 1}${answeredIds.has(item.id) ? ', answered' : ''}`}
              >
                {itemIndex + 1}{answeredIds.has(item.id) && <i />}
              </button>
            ))}
          </div>
          <div className="question-nav-legend">
            <span><i className="legend-current" />Current</span>
            <span><i className="legend-answered" />Answered</span>
            <span><i />Not yet</span>
          </div>
          <div className="practice-session-note">
            <span><Lightbulb size={14} /></span>
            <p>{isAssessment ? 'Take the time you need, but keep an eye on the clock. Answers are graded together so the set reflects one sitting.' : 'A hint comes before the solution. Your second attempt is where most of the learning happens.'}</p>
          </div>
          <button className="button button-secondary full-width" type="button" onClick={() => setConfirming(true)} disabled={submitting}><Send size={13} /> Submit this set</button>
          <p className="practice-small-print"><Info size={12} />Your answers and progress are saved on the server.</p>
        </aside>
      </div>

      {timeoutBanner()}

      {confirming && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirming(false)}>
          <div className="submit-confirm-modal" role="dialog" aria-modal="true" aria-label="Submit practice set" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close" type="button" onClick={() => setConfirming(false)} aria-label="Close"><X size={15} /></button>
            <span className="confirm-modal-icon"><Send size={17} /></span>
            <span className="eyebrow">READY TO SUBMIT?</span>
            <h2>{answeredIds.size === session.questions.length ? 'Every question has an answer.' : `${session.questions.length - answeredIds.size} question${session.questions.length - answeredIds.size === 1 ? '' : 's'} left blank.`}</h2>
            <p>{isAssessment ? 'Grading is final for this sitting. You will see every explanation and your topic breakdown afterwards.' : 'Your checked answers are already recorded. Submitting closes the set and shows your report.'}</p>
            <div className="confirm-modal-actions">
              <button className="button button-secondary" type="button" onClick={() => setConfirming(false)} disabled={submitting}>Keep working</button>
              <button className="button button-primary" type="button" onClick={() => void submit()} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit set'}<ArrowRight size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function timeoutBanner() {
    if (!expired || isAssessment && submitting) return null;
    return <div className="timeout-banner"><Clock3 size={14} />Time is up. Submit to see your report.</div>;
  }
}
