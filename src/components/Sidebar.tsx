import { NavLink, useLocation } from 'react-router-dom';
import { BookOpenText, ChevronDown, Flame, Home, Route, ShieldCheck, Sparkles, Target, UserRound } from 'lucide-react';
import type { Bootstrap } from '../types.js';
import { Brand } from './Brand.js';

const links = [
  { to: '/home', label: 'Home', icon: Home, match: (path: string) => path === '/' || path.startsWith('/home') },
  { to: '/journey', label: 'Journey', icon: Route, match: (path: string) => path.startsWith('/journey') || path.startsWith('/lesson') },
  { to: '/practice', label: 'Practice', icon: Target, match: (path: string) => path.startsWith('/practice') },
  { to: '/tutor', label: 'AI tutor', icon: Sparkles, match: (path: string) => path.startsWith('/tutor') },
  { to: '/profile', label: 'Profile', icon: UserRound, match: (path: string) => path.startsWith('/profile') },
];

export default function Sidebar({ bootstrap, open, onClose, onCompetitionChange }: {
  bootstrap: Bootstrap;
  open: boolean;
  onClose: () => void;
  onCompetitionChange: (slug: string) => void;
}) {
  const location = useLocation();
  const progress = bootstrap.stats.totalLessons ? bootstrap.stats.completedLessons / bootstrap.stats.totalLessons : 0;
  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top">
        <NavLink to="/home" className="brand-link" onClick={onClose}><Brand /></NavLink>
        <button className="sidebar-mobile-close icon-button" onClick={onClose} aria-label="Close navigation">×</button>
      </div>
      <div className="sidebar-journey-picker">
        <label className="sidebar-eyebrow" htmlFor="journey-select">YOUR CURRENT JOURNEY</label>
        <div className="journey-select-wrap">
          <BookOpenText size={17} />
          <select id="journey-select" value={bootstrap.competition.slug} onChange={(event) => onCompetitionChange(event.target.value)} aria-label="Current competition journey">
            {bootstrap.competitions.map((competition) => (
              <option key={competition.slug} value={competition.slug} disabled={!competition.available || !competition.enrolled}>
                {competition.name}{!competition.available ? ' · coming soon' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="journey-select-chevron" />
        </div>
        <div className="sidebar-progress-label"><span>{Math.round(progress * 100)}% journey complete</span><span>{bootstrap.stats.completedLessons}/{bootstrap.stats.totalLessons}</span></div>
        <div className="sidebar-progress"><span style={{ width: `${progress * 100}%` }} /></div>
      </div>
      <nav className="primary-nav" aria-label="Main navigation">
        <span className="sidebar-eyebrow nav-eyebrow">STUDY</span>
        {links.map((link) => {
          const Icon = link.icon;
          const active = link.match(location.pathname);
          return (
            <NavLink key={link.to} to={link.to} onClick={onClose} className={`nav-link ${active ? 'nav-link-active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-streak-card">
        <span className="streak-card-icon"><Flame size={14} /></span>
        <div>
          <strong>{bootstrap.stats.currentStreak}-day streak</strong>
          <span>{bootstrap.today.uniqueQuestions}/{bootstrap.user.dailyGoal} questions today</span>
          <div className="streak-card-days">
            {bootstrap.week.map((day) => <i key={day.date} className={day.active ? 'streak-day-active' : ''} title={`${day.label}: ${day.xp} XP`}>{day.label.charAt(0)}</i>)}
          </div>
        </div>
      </div>
      {bootstrap.user.role === 'admin' && <NavLink to="/admin" onClick={onClose} className={`admin-nav-link ${location.pathname.startsWith('/admin') ? 'nav-link-active' : ''}`}><ShieldCheck size={17} /> Content studio</NavLink>}
      <div className="sidebar-user">
        <div className="sidebar-user-info">
          <span className="avatar avatar-small">{bootstrap.user.fullName.trim().charAt(0).toUpperCase()}</span>
          <span className="sidebar-user-copy"><strong>{bootstrap.user.fullName}</strong><span>{bootstrap.user.isGuest ? 'Saved on this device' : `Level ${bootstrap.stats.level} learner`}</span></span>
        </div>
      </div>
    </aside>
  );
}
