import { ArrowRight, Award, CalendarDays, CheckCircle2, Flame, Sparkles, Target, TrendingUp, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Bootstrap } from '../types.js';
import { SymbolIcon } from '../components/SymbolIcon.js';

const modeLabels: Record<string, string> = {
  topic: 'Topic practice',
  mixed: 'Mixed set',
  timed: 'Timed challenge',
  review: 'Review',
  mock: 'Mock exam',
};

function MasteryRing({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  return (
    <svg className="progress-ring" width="46" height="46" viewBox="0 0 46 46" role="img" aria-label={`${percent}% topic mastery`}>
      <circle cx="23" cy="23" r="19" fill="none" stroke="var(--line)" strokeWidth="3" />
      <circle
        cx="23"
        cy="23"
        r="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(value * 119.4).toFixed(1)} 119.4`}
        transform="rotate(-90 23 23)"
      />
      <text className="ring-text" x="23" y="26" textAnchor="middle">{percent}%</text>
    </svg>
  );
}

export default function HomePage({ bootstrap }: { bootstrap: Bootstrap }) {
  const { stats, today, user, units, currentLesson } = bootstrap;
  const firstName = user.fullName.trim().split(/\s+/)[0] || 'there';
  const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const journeyProgress = stats.totalLessons ? stats.completedLessons / stats.totalLessons : 0;
  const earnedAchievements = bootstrap.achievements.filter((achievement) => achievement.earnedAt);
  const nextAssessment = bootstrap.recentAssessments[0];
  const weakest = [...units]
    .filter((unit) => unit.lessonCount > 0)
    .sort((left, right) => left.mastery - right.mastery)[0];
  const weakestNextLesson = weakest?.lessons.find((lesson) => lesson.status !== 'completed' && lesson.status !== 'mastered' && lesson.status !== 'locked');
  const dailyPercent = user.dailyGoal ? Math.min(1, today.uniqueQuestions / user.dailyGoal) : 0;
  const maxWeekXp = Math.max(1, ...bootstrap.week.map((day) => day.xp));

  return (
    <div className="dashboard-page page-enter">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">{bootstrap.competition.name.toUpperCase()} · {bootstrap.competition.subject.toUpperCase()}</span>
          <h1>Welcome back, {firstName}.</h1>
          <p>Here is the one next step that matters. Everything else can wait until you are ready.</p>
        </div>
        <span className="date-stamp"><span className="date-dot" />{dateLabel}</span>
      </div>

      <section className="continue-hero">
        <div className="hero-copy">
          <div className="hero-overline">
            <span className="hero-pulse" />
            {currentLesson ? (currentLesson.status === 'in_progress' ? 'CONTINUE WHERE YOU LEFT OFF' : 'YOUR NEXT LESSON') : 'JOURNEY COMPLETE'}
            <span className="hero-separator">/</span>
            {bootstrap.competition.name}
          </div>
          <h2>{currentLesson ? currentLesson.title : 'You have reached the end of this path.'}</h2>
          <p>{currentLesson ? currentLesson.summary : 'Revisit any lesson, keep your mastery sharp with practice, or try a timed challenge.'}</p>
          <div className="hero-progress-row">
            <span>{Math.round(journeyProgress * 100)}% complete</span>
            <div className="hero-progress-track"><span style={{ width: `${journeyProgress * 100}%` }} /></div>
            <span>{stats.completedLessons}/{stats.totalLessons}</span>
          </div>
          {currentLesson
            ? <Link className="button button-cream" to={`/lesson/${currentLesson.id}`}>{currentLesson.status === 'in_progress' ? 'Continue lesson' : 'Start lesson'}<ArrowRight size={15} /></Link>
            : <Link className="button button-cream" to="/practice">Open practice<ArrowRight size={15} /></Link>}
        </div>
        <div className="hero-visual" aria-hidden="true">
          <span className="hero-orbit orbit-a" />
          <span className="hero-orbit orbit-b" />
          <span className="hero-sun"><span className="hero-sun-center">∑</span></span>
          <span className="hero-sun-orbit orbit-label-one">π</span>
          <span className="hero-sun-orbit orbit-label-two">φ</span>
          <span className="hero-floating-note"><Sparkles size={13} />One lesson at a time</span>
        </div>
      </section>

      <div className="dashboard-stats">
        <article className="stat-card">
          <span className="stat-icon stat-icon-amber"><TrendingUp size={16} /></span>
          <div className="stat-copy">
            <span>Total XP</span>
            <strong>{stats.xp}<small> XP</small></strong>
            <div className="level-track"><span style={{ width: `${(stats.xpIntoLevel / stats.xpToNextLevel) * 100}%` }} /></div>
            <span className="stat-foot">Level {stats.level} <span>·</span> {stats.xpToNextLevel - stats.xpIntoLevel} XP to next</span>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-icon-orange"><Flame size={16} /></span>
          <div className="stat-copy">
            <span>Learning streak</span>
            <strong>{stats.currentStreak}<small> {stats.currentStreak === 1 ? 'day' : 'days'}</small></strong>
            <span className="stat-foot">Best streak <span>·</span> {stats.bestStreak} days</span>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-icon-green"><Target size={16} /></span>
          <div className="stat-copy">
            <span>Topic mastery</span>
            <strong>{Math.round(stats.topicMastery * 100)}<small>%</small></strong>
            <span className="stat-foot">{stats.correctQuestions} of {stats.answeredQuestions} questions solved</span>
          </div>
          <MasteryRing value={stats.topicMastery} />
        </article>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main-column">
          <section className="panel daily-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">TODAY’S PLAN</span>
                <h3>Small targets, real progress</h3>
              </div>
              <span className="daily-goal-pill">{today.uniqueQuestions}/{user.dailyGoal} questions today</span>
            </div>
            <div className="daily-progress"><span style={{ width: `${dailyPercent * 100}%` }} /></div>
            <div className="quest-list">
              {bootstrap.dailyQuests.map((quest) => {
                const done = quest.progress >= quest.target;
                return (
                  <div className="quest-row" key={quest.id}>
                    <span className={`quest-symbol ${done ? 'quest-symbol-done' : ''}`}>{done ? <CheckCircle2 size={14} /> : <SymbolIcon name={quest.icon} size={14} />}</span>
                    <div className="quest-copy"><strong>{quest.title}</strong><span>{quest.detail}</span></div>
                    <div className="quest-progress-wrap">
                      <div className="quest-progress"><span style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }} /></div>
                      <span>{quest.progress}/{quest.target}</span>
                    </div>
                    <span className="quest-xp">+{quest.reward} XP</span>
                  </div>
                );
              })}
            </div>
          </section>

          {weakest && (
            <section className="panel focus-panel">
              <div className="focus-copy">
                <span className="eyebrow">WORTH A SECOND LOOK</span>
                <h3>{weakest.title} is your current growth edge</h3>
                <p>
                  Your estimated mastery here is {Math.round(weakest.mastery * 100)}%, based on recent accuracy and question difficulty.
                  {weakestNextLesson ? ` “${weakestNextLesson.title}” is the natural next step.` : ' A short review set will keep it fresh.'}
                </p>
                <Link className="button button-soft" to={weakestNextLesson ? `/lesson/${weakestNextLesson.id}` : '/practice'}>
                  {weakestNextLesson ? 'Review this topic' : 'Practise this topic'}<ArrowRight size={14} />
                </Link>
              </div>
              <div className="focus-illustration" aria-hidden="true">
                <span className="focus-arc" /><span className="focus-arc focus-arc-two" />
                <span>{Math.round(weakest.mastery * 100)}%</span>
                <small>ESTIMATED</small>
              </div>
            </section>
          )}

          <section className="panel achievements-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">RECENT ACHIEVEMENTS</span><h3>Milestones that mean something</h3></div>
              <Link className="text-action" to="/profile">View all<ArrowRight size={14} /></Link>
            </div>
            {earnedAchievements.length ? (
              <div className="achievement-row">
                {earnedAchievements.slice(0, 3).map((achievement) => (
                  <div className="achievement-item" key={achievement.slug}>
                    <span className="achievement-icon"><Award size={16} /></span>
                    <div><strong>{achievement.title}</strong><span>{achievement.description}</span></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-achievements">
                <span className="empty-medal"><Trophy size={15} /></span>
                <div><strong>Your first milestone is close</strong><span>Finish a lesson to earn your first achievement.</span></div>
              </div>
            )}
          </section>
        </div>

        <div className="dashboard-side-column">
          <section className="panel week-panel">
            <div className="panel-heading">
              <div><span className="eyebrow">THIS WEEK</span><h3>Consistency</h3></div>
              <span className="week-xp">{bootstrap.week.reduce((sum, day) => sum + day.xp, 0)} XP</span>
            </div>
            <div className="week-chart">
              {bootstrap.week.map((day) => {
                const isToday = day.date === bootstrap.today.date;
                return (
                  <div className="week-column" key={day.date}>
                    <div className="week-bar-wrap">
                      <span className={`week-bar ${isToday ? 'week-bar-today' : day.active ? 'week-bar-active' : ''}`} style={{ height: `${Math.max(6, (day.xp / maxWeekXp) * 76)}px` }} title={`${day.xp} XP`} />
                    </div>
                    <span className={`week-label ${isToday ? 'week-label-active' : ''}`}>{day.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="week-caption"><span><i className="week-legend-dot" />Active days</span><span>{bootstrap.week.filter((day) => day.active).length} of 7</span></div>
          </section>

          <section className="assessment-card">
            <span className="assessment-badge"><CalendarDays size={12} />READY WHEN YOU ARE</span>
            <h3>{nextAssessment ? 'Keep your timed skills sharp' : 'Your first timed challenge'}</h3>
            <p>{nextAssessment ? `Your latest ${modeLabels[nextAssessment.mode] ?? 'assessment'} scored ${Math.round(nextAssessment.accuracy * 100)}%. A fresh set is a good next check.` : 'A short timed set shows what holds up under pressure. Answers are graded when you submit.'}</p>
            <div className="assessment-meta"><span>6 questions</span><span>·</span><span>8 minutes</span><span>·</span><span>{bootstrap.competition.name}</span></div>
            <Link className="assessment-link" to="/practice">Start a timed challenge<ArrowRight size={14} /></Link>
            <span className="assessment-watermark" aria-hidden="true">∴</span>
          </section>

          <section className="mini-unit-panel">
            <div className="mini-unit-heading"><span className="eyebrow">TOPIC MASTERY</span><Link className="text-action" to="/profile">Details<ArrowRight size={12} /></Link></div>
            <div className="mini-unit-list">
              {units.map((unit) => (
                <div className="mini-unit" key={unit.id}>
                  <span className="mini-unit-dot" style={{ background: unit.color }}><SymbolIcon name={unit.icon} size={11} /></span>
                  <div className="mini-unit-copy"><strong>{unit.shortTitle}</strong><span>{unit.completedCount}/{unit.lessonCount} lessons</span></div>
                  <div className="mini-unit-meter"><span style={{ width: `${Math.round(unit.mastery * 100)}%`, background: unit.color }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <p className="dashboard-disclaimer"><CheckCircle2 size={13} />Mastery estimates use accuracy, difficulty and recency. They are a study signal, not an official score.</p>
    </div>
  );
}
