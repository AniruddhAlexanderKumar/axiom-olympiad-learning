import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, BookOpenCheck, CalendarDays, Check, ChevronRight, Flame, LockKeyhole, ShieldCheck, Sparkles, Target, Trophy, TrendingUp, Users } from 'lucide-react';
import { patchJson } from '../api.js';
import type { Bootstrap, User } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

const modeNames: Record<string, string> = {
  topic: 'Topic practice', mixed: 'Mixed set', timed: 'Timed challenge', review: 'Review set', mock: 'Mock exam',
};

function intensity(questions: number) {
  if (questions <= 0) return '';
  if (questions < 3) return 'activity-day-1';
  if (questions < 6) return 'activity-day-2';
  if (questions < 10) return 'activity-day-3';
  return 'activity-day-4';
}

export default function ProfilePage({ bootstrap, refresh }: { bootstrap: Bootstrap; refresh: () => Promise<unknown> }) {
  const { user, stats } = bootstrap;
  const [form, setForm] = useState({ fullName: user.fullName, grade: user.grade, dailyGoal: String(user.dailyGoal) });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const earned = bootstrap.achievements.filter((achievement) => achievement.earnedAt);
  const locked = bootstrap.achievements.filter((achievement) => !achievement.earnedAt);
  const earnedXp = earned.reduce((sum, achievement) => sum + achievement.xpBonus, 0);
  const calendar = bootstrap.calendar;
  const leadingBlanks = calendar.length ? calendar[0].weekday : 0;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      await patchJson('/profile', { fullName: form.fullName, grade: form.grade, dailyGoal: Number(form.dailyGoal) });
      await refresh();
      setMessage('Saved. Your profile is up to date.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your profile could not be saved.');
    } finally { setSaving(false); }
  };

  const setOptIn = async (enabled: boolean) => {
    setError('');
    try {
      await patchJson('/profile', { leaderboardOptIn: enabled });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your league preference could not be saved.');
    }
  };

  const updateTheme = async (theme: User['theme']) => {
    try {
      await patchJson('/profile', { theme });
      document.documentElement.dataset.theme = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your appearance could not be saved.');
    }
  };

  return (
    <div className="profile-page page-enter">
      <div className="page-heading profile-heading">
        <div>
          <span className="eyebrow">YOUR LEARNING RECORD</span>
          <h1>Profile &amp; progress</h1>
          <p>A genuine picture of what you know: mastery, consistency and the work still ahead — not just time spent.</p>
        </div>
        <span className="date-stamp"><CalendarDays size={13} />{bootstrap.competition.name} · {bootstrap.competition.level}</span>
      </div>

      <section className="profile-overview-card">
        <div className="profile-identity">
          <span className="profile-avatar">{user.fullName.trim().charAt(0).toUpperCase()}</span>
          <div>
            <span className="eyebrow">{user.isGuest ? 'GUEST STUDY SPACE' : user.role === 'admin' ? 'ADMINISTRATOR' : 'STUDENT'}</span>
            <h2>{user.fullName}</h2>
            <span>{user.isGuest ? 'Saved on this device · add an account to sync' : user.email}</span>
          </div>
        </div>
        <div className="profile-level">
          <div className="profile-level-heading"><span>LEVEL {stats.level}</span><strong>{stats.xp}<small> XP</small></strong></div>
          <div className="level-track"><span style={{ width: `${(stats.xpIntoLevel / stats.xpToNextLevel) * 100}%` }} /></div>
          <span>{stats.xpToNextLevel - stats.xpIntoLevel} XP to level {stats.level + 1}</span>
        </div>
        <div className="profile-overview-metrics">
          <div><span><Flame size={12} />STREAK</span><strong>{stats.currentStreak}<small> {stats.currentStreak === 1 ? 'day' : 'days'}</small></strong></div>
          <div><span><BookOpenCheck size={12} />LESSONS</span><strong>{stats.completedLessons}<small>/{stats.totalLessons}</small></strong></div>
          <div><span><Target size={12} />MASTERY</span><strong>{Math.round(stats.topicMastery * 100)}<small>%</small></strong></div>
        </div>
      </section>

      <div className="profile-layout-grid">
        <div className="profile-main-column">
          <section className="panel profile-calendar-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">LAST 28 DAYS</span><h3>Learning activity</h3></div>
              <span className="calendar-legend"><i />Questions answered</span>
            </div>
            <div className="activity-calendar-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, dayIndex) => <span key={`${day}-${dayIndex}`}>{day}</span>)}</div>
            <div className="activity-calendar-grid">
              {Array.from({ length: leadingBlanks }, (_, blank) => <span className="activity-day activity-day-blank" key={`blank-${blank}`} />)}
              {calendar.map((day) => (
                <span className={`activity-day ${intensity(day.questions)}`} key={day.date} title={`${day.date}: ${day.questions} questions, ${day.lessons} lessons, ${day.xp} XP`}>
                  {day.day}{day.lessons > 0 && <i />}
                </span>
              ))}
            </div>
            <div className="calendar-caption"><span>RHYTHM</span><span>{calendar.filter((day) => day.active).length} active {calendar.filter((day) => day.active).length === 1 ? 'day' : 'days'}<span>·</span>{stats.bestStreak}-day best streak</span></div>
          </section>

          <section className="panel profile-mastery-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">KNOWLEDGE, ESTIMATED</span><h3>Topic mastery</h3></div>
              <span className="mastery-caption">Accuracy × difficulty × recency</span>
            </div>
            <div className="mastery-list">
              {bootstrap.units.map((unit) => (
                <div className="mastery-row" key={unit.id}>
                  <span className="mastery-unit-icon" style={{ color: unit.color, background: 'var(--surface-soft)' }}><SymbolIcon name={unit.icon} size={14} /></span>
                  <div className="mastery-unit-name"><strong>{unit.title}</strong><span>{unit.completedCount} of {unit.lessonCount} lessons complete</span></div>
                  <div className="mastery-row-track"><span style={{ width: `${Math.round(unit.mastery * 100)}%`, background: unit.color }} /></div>
                  <span className="mastery-percent">{Math.round(unit.mastery * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="mastery-explainer"><TrendingUp size={13} />Mastery is a study signal from graded attempts, weighted by question difficulty and recency. Completing a lesson is not the same as mastering it.</div>
          </section>

          <section className="panel profile-achievements-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">MILESTONES</span><h3>Achievements <span className="achievement-count">{earned.length}/{bootstrap.achievements.length}</span></h3></div>
              <span className="achievement-total-xp"><Sparkles size={12} />+{earnedXp} bonus XP</span>
            </div>
            {earned.length ? (
              <div className="profile-achievements-grid">
                {earned.map((achievement) => (
                  <article className="profile-achievement earned" key={achievement.slug}>
                    <span className="profile-achievement-icon"><Award size={14} /></span>
                    <span className="achievement-category">{achievement.category}</span>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.description}</p>
                    <span className="achievement-earned-mark"><Check size={10} />Earned</span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="achievement-empty-message"><Trophy size={15} />Your first achievement arrives with your first completed lesson.</div>
            )}
            {locked.length > 0 && (
              <details className="locked-achievements">
                <summary><ChevronRight size={12} />Still to earn ({locked.length})</summary>
                <div className="profile-achievements-grid">
                  {locked.map((achievement) => (
                    <article className="profile-achievement locked" key={achievement.slug}>
                      <span className="profile-achievement-icon"><LockKeyhole size={13} /></span>
                      <span className="achievement-category">{achievement.category}</span>
                      <strong>{achievement.title}</strong>
                      <p>{achievement.description}</p>
                    </article>
                  ))}
                </div>
              </details>
            )}
          </section>
        </div>

        <div className="profile-side-column">
          <section className="panel weekly-league-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">WEEKLY LEAGUE</span><h3>Learning, ranked fairly</h3></div>
              <span className="league-week-badge">THIS WEEK</span>
            </div>
            {bootstrap.leaderboard.enabled ? (
              <>
                <div className="league-list">
                  {bootstrap.leaderboard.entries.length ? bootstrap.leaderboard.entries.slice(0, 8).map((entry) => (
                    <div className={`league-entry ${entry.isYou ? 'league-entry-you' : ''}`} key={`${entry.rank}-${entry.name}`}>
                      <span className={`league-rank ${entry.rank <= 3 ? 'league-rank-top' : ''}`}>{entry.rank}</span>
                      <span className="league-avatar">{entry.name.trim().charAt(0).toUpperCase()}</span>
                      <span className="league-name">{entry.name}{entry.isYou && <small>YOU</small>}</span>
                      <strong>{entry.xp}<small> XP</small></strong>
                    </div>
                  )) : <div className="league-empty"><Users size={18} /><strong>No one has opted in yet</strong><span>You are the first in this league. Your weekly XP will appear here.</span></div>}
                </div>
                <p className="league-privacy"><ShieldCheck size={12} />Only first name and weekly XP are shown. Quiz repetition does not earn more XP.</p>
                <button className="text-button" type="button" onClick={() => void setOptIn(false)}>Leave the league</button>
              </>
            ) : (
              <div className="league-opt-in">
                <span className="league-opt-icon"><Users size={16} /></span>
                <strong>Compare real learning activity</strong>
                <p>Weekly XP is capped for repeated questions and favours first-time solves, assessments and consistency.</p>
                <button className="button button-soft" type="button" onClick={() => void setOptIn(true)}>Join this week’s league</button>
              </div>
            )}
          </section>

          <section className="panel assessment-history-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">ASSESSMENTS</span><h3>Recent results</h3></div>
              <span className="assessment-history-count">{bootstrap.recentAssessments.length} shown</span>
            </div>
            {bootstrap.recentAssessments.length ? (
              <div className="assessment-history-list">
                {bootstrap.recentAssessments.map((assessment) => (
                  <div className="assessment-history-row" key={assessment.id}>
                    <span className="history-icon"><CalendarDays size={13} /></span>
                    <div className="history-copy">
                      <strong>{modeNames[assessment.mode] ?? 'Assessment'}</strong>
                      <span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(assessment.submittedAt))} · {assessment.correctCount}/{assessment.questionCount} correct</span>
                    </div>
                    <span className="history-score">{Math.round(assessment.accuracy * 100)}%</span>
                    <span className="history-time">{Math.max(1, Math.round(assessment.timeTakenSeconds / 60))}m</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="assessment-history-empty">
                <span><Target size={14} /></span>
                <div><strong>No assessments yet</strong><small>A timed challenge gives you a topic breakdown afterwards.</small></div>
                <Link to="/practice">Start<ArrowRight size={12} /></Link>
              </div>
            )}
          </section>

          <section className="panel profile-subject-panel">
            <span className="eyebrow">ACTIVE JOURNEY</span>
            <div className="active-track-header">
              <span className="active-track-icon"><BookOpenCheck size={15} /></span>
              <div><strong>{bootstrap.competition.name}</strong><span>{bootstrap.competition.subject} · {bootstrap.competition.level}</span></div>
              <i className="active-track-dot" />
            </div>
            <p>{bootstrap.competition.description}</p>
            <div className="active-track-progress"><span style={{ width: `${stats.totalLessons ? (stats.completedLessons / stats.totalLessons) * 100 : 0}%` }} /></div>
            <div className="active-track-meta"><span>{stats.completedLessons}/{stats.totalLessons} lessons</span><Link to="/journey">Continue<ArrowRight size={11} /></Link></div>
          </section>

          <section className="panel profile-settings-panel">
            <div className="panel-heading"><div><span className="eyebrow">SETTINGS</span><h3>Your study preferences</h3></div><ShieldCheck size={15} /></div>
            <form className="profile-settings-form" onSubmit={saveProfile}>
              <label className="field-label">Name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required minLength={2} maxLength={60} autoComplete="name" /></label>
              <div className="settings-pair">
                <label className="field-label">Grade
                  <select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>
                    <option value="">Not set</option>
                    {['6', '7', '8', '9', '10', '11', '12', 'Other'].map((grade) => <option key={grade} value={grade}>{grade === 'Other' ? 'Other' : `Grade ${grade}`}</option>)}
                  </select>
                </label>
                <label className="field-label">Daily goal
                  <select value={form.dailyGoal} onChange={(event) => setForm({ ...form, dailyGoal: event.target.value })}>
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((goal) => <option key={goal} value={goal}>{goal} question{goal === 1 ? '' : 's'}</option>)}
                  </select>
                </label>
              </div>
              <label className="field-label">Appearance
                <select value={user.theme} onChange={(event) => void updateTheme(event.target.value as User['theme'])}>
                  <option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option>
                </select>
              </label>
              {error && <div className="form-error">{error}</div>}
              {message && <div className="form-success"><Check size={13} />{message}</div>}
              <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</button>
            </form>
          </section>
        </div>
      </div>
      <p className="profile-content-note"><ShieldCheck size={12} />Progress is stored on the server and follows your account across devices. {user.isGuest ? 'This guest space lives on this device until you save it.' : ''}</p>
    </div>
  );
}
