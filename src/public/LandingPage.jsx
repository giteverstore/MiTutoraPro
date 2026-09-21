import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bot, Brackets, Bug, Check, Code2, Database, Globe, Layers3, MessagesSquare, Play, TerminalSquare, Type } from 'lucide-react';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { requestAuthentication } from './publicAuthNavigation';

const LandingAnimationContext = createContext(null);

function LandingAnimationProvider({ children }) {
  const [activeId, setActiveId] = useState(null);
  const [documentVisible, setDocumentVisible] = useState(typeof document === 'undefined' || document.visibilityState === 'visible');
  const nodesRef = useRef(new Map());
  const entriesRef = useRef(new Map());
  const observerRef = useRef(null);
  const refCallbacksRef = useRef(new Map());

  const selectActiveSection = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    const viewportCenter = window.innerHeight / 2;
    const candidates = [...entriesRef.current.entries()].filter(([, entry]) => entry.isIntersecting && entry.intersectionRatio >= 0.5).map(([id, entry]) => ({ id, ratio: entry.intersectionRatio, centerDistance: Math.abs((entry.boundingClientRect.top + (entry.boundingClientRect.height / 2)) - viewportCenter) }));
    candidates.sort((a, b) => (Math.abs(b.ratio - a.ratio) > 0.05 ? b.ratio - a.ratio : a.centerDistance - b.centerDistance));
    setActiveId(candidates[0]?.id ?? null);
  }, []);

  const register = useCallback((id) => {
    if (!refCallbacksRef.current.has(id)) {
      refCallbacksRef.current.set(id, (node) => {
        const previous = nodesRef.current.get(id);
        if (previous) observerRef.current?.unobserve(previous);
        if (node) {
          nodesRef.current.set(id, node);
          observerRef.current?.observe(node);
        } else {
          nodesRef.current.delete(id);
          entriesRef.current.delete(id);
        }
      });
    }
    return refCallbacksRef.current.get(id);
  }, []);

  useEffect(() => {
    if (!window.IntersectionObserver) return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = [...nodesRef.current.entries()].find(([, node]) => node === entry.target)?.[0];
        if (id) entriesRef.current.set(id, entry);
      });
      selectActiveSection();
    }, { threshold: [0, 0.5, 0.75, 1] });
    observerRef.current = observer;
    nodesRef.current.forEach((node) => observer.observe(node));
    return () => { observer.disconnect(); observerRef.current = null; entriesRef.current.clear(); };
  }, [selectActiveSection]);
  useEffect(() => {
    const updateVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setDocumentVisible(visible);
      if (visible) selectActiveSection();
    };
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, [selectActiveSection]);

  const value = useMemo(() => ({ activeId, documentVisible, register }), [activeId, documentVisible, register]);
  return <LandingAnimationContext.Provider value={value}>{children}</LandingAnimationContext.Provider>;
}

function useLandingAnimationSection(id) {
  const context = useContext(LandingAnimationContext);
  return { sectionRef: context.register(id), animationActive: context.documentVisible && context.activeId === id };
}

function LandingMetadata() {
  useEffect(() => {
    const previousTitle = document.title;
    let description = document.head.querySelector('meta[name="description"]');
    const created = !description;
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.append(description); }
    const previousDescription = description.content;
    document.title = 'Y Coders - Learn Coding by Building';
    description.content = 'Learn programming through structured courses, coding practice, and real projects with Y Coders.';
    return () => { document.title = previousTitle; if (created) description.remove(); else description.content = previousDescription; };
  }, []);
  return null;
}

const showcaseItems = [
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'sql', label: 'SQL', icon: Database },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'ai-chat', label: 'AI Chat', icon: MessagesSquare },
  { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
];

function CodeShowcase() {
  return <div className="landing-workspace landing-workspace--code"><header><span><Code2 /> main.py</span><button type="button" tabIndex={-1}><Play /> Run</button></header><ol><li><code><b>def</b> greet(name):</code></li><li><code>    <b>return</b> f&quot;Hello, {'{'}name{'}'}!&quot;</code></li><li><code>&nbsp;</code></li><li><code>print(greet(&quot;Y Coders&quot;))</code></li></ol><footer><strong>OUTPUT</strong><code>Hello, Y Coders!</code></footer></div>;
}

function SqlShowcase() {
  return <div className="landing-workspace landing-workspace--sql"><header><span><Database /> Query.sql</span><button type="button" tabIndex={-1}><Play /> Run</button></header><pre><code><b>SELECT</b> name, score{`\n`}<b>FROM</b> students{`\n`}<b>WHERE</b> score &gt; 80{`\n`}<b>ORDER BY</b> score <b>DESC</b>;</code></pre><footer><div className="landing-workspace-tabs"><strong>RESULTS</strong><span>CONSOLE</span></div><table><thead><tr><th>INPUT</th><th>OUTPUT</th><th>EXPECTED</th></tr></thead><tbody><tr><td>Alice</td><td>96</td><td>Pass</td></tr><tr><td>Bob</td><td>91</td><td>Pass</td></tr><tr><td>Charlie</td><td>84</td><td>Pass</td></tr></tbody></table></footer></div>;
}

function WebShowcase() {
  return <div className="landing-workspace landing-workspace--web"><header><span><Globe /> index.html</span><div className="landing-workspace-tabs"><strong>HTML</strong><span>CSS</span><span>Preview</span></div></header><div className="landing-web-preview"><code>&lt;main&gt;<br />&nbsp;&nbsp;&lt;h1&gt;Build for the web&lt;/h1&gt;<br />&nbsp;&nbsp;&lt;button&gt;Start building&lt;/button&gt;<br />&lt;/main&gt;</code><section><span>YOUR NEXT PROJECT</span><strong>Build for the web</strong><button type="button" tabIndex={-1}>Start building</button></section></div></div>;
}

function AiShowcase() {
  return <div className="landing-workspace landing-workspace--chat"><header><span><Bot /> Coding assistant</span><small>Guided support</small></header><div><p className="is-user"><strong>You</strong>Why is my loop running forever?</p><p className="is-assistant"><strong>AI Mentor</strong>Check whether the loop condition can ever become false.<code>while count &lt; 10:{`\n`}    count += 1</code></p></div></div>;
}

function TerminalShowcase() {
  return <div className="landing-workspace landing-workspace--terminal"><header><span><TerminalSquare /> Terminal</span><i /><i /><i /></header><pre><code><b>$</b> python app.py{`\n`}Hello, Y Coders!{`\n\n`}<b>$</b> git status{`\n`}On branch main{`\n`}nothing to commit</code></pre></div>;
}

const showcasePanels = { code: CodeShowcase, sql: SqlShowcase, web: WebShowcase, 'ai-chat': AiShowcase, terminal: TerminalShowcase };

function LandingFeatureShowcase() {
  const { sectionRef, animationActive } = useLandingAnimationSection('building');
  useEffect(() => {
    const node = document.querySelector('.landing-building');
    sectionRef(node);
    return () => sectionRef(null);
  }, [sectionRef]);
  const [activeId, setActiveId] = useState(showcaseItems[0].id);
  const [outgoingId, setOutgoingId] = useState(null);
  const [cycleKey, setCycleKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabsRef = useRef([]);
  const activeIdRef = useRef(activeId);
  const transitionTimerRef = useRef(0);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const transitionTo = (id) => {
    const current = activeIdRef.current;
    if (id === current) return;
    window.clearTimeout(transitionTimerRef.current);
    if (!reduceMotion) {
      setOutgoingId(current);
      transitionTimerRef.current = window.setTimeout(() => setOutgoingId(null), 360);
    } else setOutgoingId(null);
    activeIdRef.current = id;
    setActiveId(id);
  };
  useEffect(() => {
    if (reduceMotion || paused || !animationActive) return undefined;
    const timer = window.setInterval(() => {
      const currentIndex = showcaseItems.findIndex(({ id }) => id === activeIdRef.current);
      transitionTo(showcaseItems[(currentIndex + 1) % showcaseItems.length].id);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [animationActive, cycleKey, paused, reduceMotion]);
  useEffect(() => {
    if (animationActive) return;
    window.clearTimeout(transitionTimerRef.current);
    setOutgoingId(null);
  }, [animationActive]);
  useEffect(() => () => window.clearTimeout(transitionTimerRef.current), []);
  const select = (id) => { transitionTo(id); setCycleKey((value) => value + 1); };
  const move = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + showcaseItems.length) % showcaseItems.length;
    select(showcaseItems[next].id);
    tabsRef.current[next]?.focus();
  };
  const ActivePanel = showcasePanels[activeId];
  const OutgoingPanel = outgoingId ? showcasePanels[outgoingId] : null;
  const activeLabel = showcaseItems.find(({ id }) => id === activeId).label;
  return <section className="landing-building" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}><div className="landing-building-shape" aria-hidden="true" /><div className="landing-building-copy"><h2><span>Don’t Just Learn.</span> <span className="accent">Start Building.</span></h2><p>Write real code, build websites, work with databases, and explore AI all through interactive, hands-on lessons designed to make you a better Y Coders.</p><div className="landing-feature-tabs" role="tablist" aria-label="Interactive learning features">{showcaseItems.map(({ id, label, icon: Icon }, index) => <button id={`landing-feature-tab-${id}`} type="button" role="tab" aria-selected={activeId === id} aria-controls="landing-feature-panel" tabIndex={activeId === id ? 0 : -1} className={activeId === id ? 'is-active' : ''} onClick={() => select(id)} onKeyDown={(event) => move(event, index)} ref={(element) => { tabsRef.current[index] = element; }} key={id}><Icon />{label}</button>)}</div></div><div className="landing-feature-panel" id="landing-feature-panel" role="tabpanel" aria-labelledby={`landing-feature-tab-${activeId}`} aria-label={`${activeLabel} interactive lesson preview`}>{OutgoingPanel ? <div className="landing-showcase-layer is-outgoing" aria-hidden="true" inert=""><OutgoingPanel /></div> : null}<div className="landing-showcase-layer is-incoming" key={activeId}><ActivePanel /></div></div></section>;
}

const LANDING_LANGUAGES = [
  { id: 'python', name: 'Python', logo: '/assets/languages/python.svg' },
  { id: 'java', name: 'Java', logo: '/assets/languages/java.svg' },
  { id: 'cpp', name: 'C++', logo: '/assets/languages/cplusplus.svg' },
  { id: 'sql', name: 'SQL', logo: '/assets/languages/sql.svg' },
  { id: 'html', name: 'HTML', logo: '/assets/languages/html5.svg' },
];

function LandingCoursesShowcase() {
  const { sectionRef, animationActive } = useLandingAnimationSection('courses');
  const [languageIndex, setLanguageIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState(null);
  const [typedName, setTypedName] = useState('');
  const [phase, setPhase] = useState('typing');
  const outgoingTimerRef = useRef(0);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const language = LANDING_LANGUAGES[languageIndex];

  useEffect(() => {
    if (reduceMotion) {
      setTypedName(LANDING_LANGUAGES[0].name);
      return undefined;
    }
    if (!animationActive) return undefined;
    let delay = 90;
    let next = () => setTypedName(language.name.slice(0, typedName.length + 1));
    if (phase === 'typing' && typedName === language.name) {
      delay = 1800;
      next = () => setPhase('deleting');
    } else if (phase === 'deleting' && typedName.length > 0) {
      delay = 50;
      next = () => setTypedName(typedName.slice(0, -1));
    } else if (phase === 'deleting') {
      delay = 0;
      next = () => {
        const nextIndex = (languageIndex + 1) % LANDING_LANGUAGES.length;
        const transitionDuration = LANDING_LANGUAGES[nextIndex].name.length * 90;
        setOutgoingIndex(languageIndex);
        setLanguageIndex(nextIndex);
        setPhase('typing');
        window.clearTimeout(outgoingTimerRef.current);
        outgoingTimerRef.current = window.setTimeout(() => setOutgoingIndex(null), transitionDuration);
      };
    }
    const timer = window.setTimeout(next, delay);
    return () => window.clearTimeout(timer);
  }, [animationActive, language.name, languageIndex, phase, reduceMotion, typedName]);
  useEffect(() => {
    if (animationActive) return;
    window.clearTimeout(outgoingTimerRef.current);
    setOutgoingIndex(null);
  }, [animationActive]);
  useEffect(() => () => window.clearTimeout(outgoingTimerRef.current), []);

  const outgoingLanguage = outgoingIndex === null ? null : LANDING_LANGUAGES[outgoingIndex];
  const transitionStyle = { '--landing-language-transition': `${language.name.length * 90}ms` };
  return <section className="landing-showcase landing-courses" aria-labelledby="landing-courses-title" ref={sectionRef}><header><div><h2 id="landing-courses-title">Courses that move<br />from <span className="accent">concept to code.</span></h2></div></header><p className="visually-hidden">Languages available: Python, Java, C++, SQL, and HTML.</p><div className="landing-language-showcase" style={transitionStyle}><div className="landing-language-logo" aria-hidden="true">{outgoingLanguage ? <img className="is-outgoing" src={outgoingLanguage.logo} alt="" /> : null}<img className="is-incoming" src={language.logo} alt="" key={language.id} /></div><div className="landing-language-copy"><div className="landing-language-name" aria-hidden="true"><span>{typedName}</span><i /></div></div></div><div className="landing-courses-cta"><a className="button button--primary" href="/library">Explore Courses <ArrowRight /></a></div></section>;
}

const PRACTICE_SHOWCASE = [
  { id: 'arrays', title: 'Arrays', description: 'Work with indexed collections, searching, traversal, and transformations.', snippet: 'nums = [2, 4, 6, 8]', icon: Brackets },
  { id: 'strings', title: 'Strings', description: 'Explore text processing, matching, slicing, and useful transformations.', snippet: 'text = "ycoders"', icon: Type },
  { id: 'data-structures', title: 'Data Structures', description: 'Build efficient ways to organize, retrieve, and update information.', snippet: 'stack.push(value)', icon: Layers3 },
  { id: 'sql', title: 'SQL', description: 'Query structured data and turn stored records into useful answers.', snippet: 'SELECT * FROM users;', icon: Database },
  { id: 'debugging', title: 'Debugging', description: 'Trace unexpected behavior, identify mistakes, and repair broken logic.', snippet: 'if (count > 0) { ... }', icon: Bug },
];

function LandingPracticeShowcase() {
  const { sectionRef, animationActive } = useLandingAnimationSection('practice');
  const [topicIndex, setTopicIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState(null);
  const outgoingTimerRef = useRef(0);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduceMotion || !animationActive) return undefined;
    const timer = window.setInterval(() => {
      setTopicIndex((current) => {
        setOutgoingIndex(current);
        window.clearTimeout(outgoingTimerRef.current);
        outgoingTimerRef.current = window.setTimeout(() => setOutgoingIndex(null), 340);
        return (current + 1) % PRACTICE_SHOWCASE.length;
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [animationActive, reduceMotion]);
  useEffect(() => {
    if (animationActive) return;
    window.clearTimeout(outgoingTimerRef.current);
    setOutgoingIndex(null);
  }, [animationActive]);
  useEffect(() => () => window.clearTimeout(outgoingTimerRef.current), []);

  const renderTopic = (topic, state) => {
    const Icon = topic.icon;
    return <div className={`landing-practice-topic ${state}`} aria-hidden="true" key={`${state}-${topic.id}`}><div className="landing-practice-topic-icon"><Icon /></div><h3>{topic.title}</h3><p>{topic.description}</p><pre><code>{topic.snippet}</code></pre><div className="landing-practice-difficulties"><DifficultyBadge difficulty="easy" /><DifficultyBadge difficulty="medium" /><DifficultyBadge difficulty="hard" /></div></div>;
  };
  const topic = PRACTICE_SHOWCASE[topicIndex];
  const outgoingTopic = outgoingIndex === null ? null : PRACTICE_SHOWCASE[outgoingIndex];
  return <div className="landing-practice-showcase" ref={sectionRef}><p className="visually-hidden">Practice topics include Arrays, Strings, Data Structures, SQL, and Debugging.</p>{outgoingTopic ? renderTopic(outgoingTopic, 'is-outgoing') : null}{renderTopic(topic, 'is-incoming')}</div>;
}

const PROJECT_FEATURES = ['Solve Real Problems', 'Explore Full Stack, Data Science & AI', 'Build Your Portfolio', 'Gain Practical, Job-Ready Skills'];

function LandingProjectFeatures() {
  const { sectionRef, animationActive } = useLandingAnimationSection('projects');
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [checkedCount, setCheckedCount] = useState(reduceMotion ? PROJECT_FEATURES.length : 0);
  const [started, setStarted] = useState(reduceMotion);

  useEffect(() => {
    if (!reduceMotion && animationActive && !started) setStarted(true);
  }, [animationActive, reduceMotion, started]);
  useEffect(() => {
    if (!started || reduceMotion || !animationActive || checkedCount >= PROJECT_FEATURES.length) return undefined;
    const timer = window.setTimeout(
      () => setCheckedCount((count) => Math.min(count + 1, PROJECT_FEATURES.length)),
      checkedCount === 0 ? 400 : 450,
    );
    return () => window.clearTimeout(timer);
  }, [animationActive, checkedCount, reduceMotion, started]);

  return <ul className="landing-project-features" ref={sectionRef} data-animation-active={animationActive}>{PROJECT_FEATURES.map((item, index) => {
    const checked = index < checkedCount;
    return <li className={checked ? 'is-checked' : ''} key={item}><span className="landing-project-feature-icon" aria-hidden="true">{checked ? <Check /> : <i />}</span><span>{item}</span></li>;
  })}</ul>;
}

const HOW_IT_WORKS_STEPS = [
  { id: 'learn', number: '1', title: 'Learn', placement: 'below', cx: 80, cy: 390, description: 'Follow structured courses and understand programming concepts through guided lessons and examples.' },
  { id: 'practice', number: '2', title: 'Practice', placement: 'above', cx: 380, cy: 280, description: 'Solve coding questions, test your understanding, and improve through hands-on exercises.' },
  { id: 'build', number: '3', title: 'Build', placement: 'below', cx: 660, cy: 190, description: 'Apply your skills to real projects and create work you can showcase.' },
  { id: 'grow', number: '4', title: 'Grow', placement: 'above', cx: 920, cy: 90, description: 'Track your progress, complete challenges, earn rewards, and keep building momentum.' },
];

function LandingHowJourney() {
  const [selectedId, setSelectedId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const activeId = previewId ?? selectedId;
  const activateFromKeyboard = (event, id) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setSelectedId(id);
    setPreviewId(id);
  };

  return <div className="landing-how-journey"><div className="landing-how-geometry" style={{ aspectRatio: '2 / 1' }}>
    <svg className="landing-how-path" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M 80 390 C 175 430, 285 350, 380 280 C 475 210, 565 250, 660 190 C 755 130, 825 135, 920 90" />
      {HOW_IT_WORKS_STEPS.map(({ id, cx, cy }) => {
        const active = activeId === id;
        return <g className={active ? 'landing-how-point is-active' : 'landing-how-point'} data-stage={id} key={id}><circle className="landing-how-point-halo" cx={cx} cy={cy} r="18" /><circle className="landing-how-point-dot" cx={cx} cy={cy} r={active ? 11 : 8} /></g>;
      })}
    </svg>
    <ol>{HOW_IT_WORKS_STEPS.map(({ id, number, title, placement, cx, cy, description }) => {
      const active = activeId === id;
      const descriptionId = `landing-how-${id}-description`;
      return <li className={`landing-how-step is-${placement}${active ? ' is-active' : ''}`} data-placement={placement} data-cx={cx} data-cy={cy} style={{ '--landing-how-x': `${cx / 10}%`, '--landing-how-y': `${cy / 5}%` }} key={id}>
        <button className="landing-how-marker" type="button" aria-label={`${title} — show details`} aria-expanded={active} aria-controls={descriptionId} onMouseEnter={() => setPreviewId(id)} onMouseLeave={() => setPreviewId(null)} onFocus={() => setPreviewId(id)} onBlur={() => setPreviewId(null)} onClick={() => setSelectedId(id)} onKeyDown={(event) => activateFromKeyboard(event, id)}><span className="landing-how-mobile-point" /></button>
        <div><span className="landing-how-number" aria-hidden="true">{number}</span><h3>{title}</h3><p id={descriptionId} className={active ? 'is-visible' : ''} aria-hidden={!active}>{description}</p></div>
      </li>;
    })}</ol>
  </div></div>;
}

function LandingPageContent() {
  const heroRef = useRef(null);
  const heroRectRef = useRef(null);
  const heroPointerRef = useRef(null);
  const heroFrameRef = useRef(0);
  useEffect(() => () => window.cancelAnimationFrame(heroFrameRef.current), []);
  const activateHeroGrid = (event) => {
    if (event.pointerType === 'touch') return;
    heroRectRef.current = heroRef.current?.getBoundingClientRect() ?? null;
    heroRef.current?.classList.add('is-pointer-active');
  };
  const moveHeroGrid = (event) => {
    if (event.pointerType === 'touch') return;
    heroPointerRef.current = { x: event.clientX, y: event.clientY };
    if (heroFrameRef.current) return;
    heroFrameRef.current = window.requestAnimationFrame(() => {
      heroFrameRef.current = 0;
      const rect = heroRectRef.current;
      const pointer = heroPointerRef.current;
      if (!rect || !pointer || !heroRef.current) return;
      heroRef.current.style.setProperty('--hero-pointer-x', `${pointer.x - rect.left}px`);
      heroRef.current.style.setProperty('--hero-pointer-y', `${pointer.y - rect.top}px`);
    });
  };
  const deactivateHeroGrid = (event) => {
    if (event.pointerType === 'touch') return;
    heroRef.current?.classList.remove('is-pointer-active');
  };
  return <div className="landing-page" data-brand-theme="blue" data-theme="light"><LandingMetadata /><PublicHeader activePath="/" /><main>
    <section className="landing-hero" ref={heroRef} onPointerEnter={activateHeroGrid} onPointerMove={moveHeroGrid} onPointerLeave={deactivateHeroGrid}>
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="landing-hero-grid-highlight" aria-hidden="true" />
      <div className="landing-hero-copy">
        <div className="landing-hero-avatars" aria-hidden="true">{[1, 2, 3, 4, 5].map((avatar) => <img src={`/assets/avatars/landing-avatar-${avatar}.svg`} alt="" key={avatar} />)}</div>
        <p className="landing-hero-intro">From Beginner to Code Master With Y Coders</p>
        <h1>From ‘I Understand’ to ‘I Built It!’</h1>
        <p className="landing-hero-primary">Learn. Build. Compete. Get Hired. With Y Coders.</p>
        <p className="landing-hero-secondary">Your Coding Journey Starts Here Learn by Building!</p>
        <div className="landing-hero-actions"><button className="button button--primary" type="button" onClick={() => requestAuthentication('/', 'login')}><img src="/assets/brands/google-g.svg" alt="" aria-hidden="true" />Sign in</button><a className="button button--secondary" href="/library">Explore Courses</a></div>
      </div>
    </section>
    <LandingFeatureShowcase />
    <LandingCoursesShowcase />
    <section className="landing-split landing-practice"><div><h2>Practice What<br />You Learn.</h2><p>Browse coding questions by topic and difficulty, then sign in when you are ready to run solutions and track completion.</p><a className="button button--primary" href="/practice">Explore Practice <ArrowRight /></a></div><LandingPracticeShowcase /></section>
    <section className="landing-projects"><div className="landing-project-illustration"><img src="/assets/landing/project-building-illustration.png" alt="Developer building a web project across multiple screens" /></div><div className="landing-section-copy"><h2>Don’t Just Learn. Build Something Real.</h2><p>Build hands-on projects, explore in-demand technologies, and gain job-ready skills with Y Coders.</p><LandingProjectFeatures /><a className="button button--primary" href="/projects">Explore Projects <ArrowRight /></a></div></section>
    <section className="landing-mentor" aria-labelledby="landing-mentor-title">
      <div className="landing-mentor-illustration">
        <img src="/assets/landing/ai-coding-mentor-illustration.png" alt="AI coding mentor helping a learner debug code" />
      </div>
      <div className="landing-mentor-copy">
        <h2 id="landing-mentor-title">Stuck on Code? Ask Your AI Mentor.</h2>
        <p className="landing-mentor-description">Get instant, step-by-step guidance while you code. Ask questions, fix bugs, understand concepts, and improve your solutions inside eligible learning experiences. Authentication and Premium access are required.</p>
        <h3>How It Works</h3>
        <ol className="landing-mentor-steps">
          {[
            ['01', 'Ask Anything', 'Got a coding question? Ask your AI mentor and get clear, easy-to-understand answers.'],
            ['02', 'Learn Step by Step', 'Understand the logic behind the solution instead of simply copying the answer.'],
            ['03', 'Debug & Improve', 'Debug, optimize, and improve your code.'],
          ].map(([number, title, description]) => <li key={number}><span aria-hidden="true">{number}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}
        </ol>
        <p className="landing-mentor-tagline">Code. Ask. Debug. Improve. — With Y Coders.</p>
        <button className="button button--primary" type="button" onClick={() => requestAuthentication('/practice', 'login')}>Ask AI Mentor <ArrowRight /></button>
      </div>
    </section>
    <section className="landing-how" aria-labelledby="landing-how-title">
      <div className="landing-how-intro">
        <h2 id="landing-how-title">Learn. Practice. Build. Grow.</h2>
        <p>A simple path from learning the fundamentals to building real projects and tracking your progress.</p>
        <button className="button button--primary" type="button" onClick={() => requestAuthentication('/', 'signup')}>Get Started <ArrowRight /></button>
      </div>
      <LandingHowJourney />
    </section>
    <section className="landing-final-cta" aria-labelledby="landing-final-cta-title">
      <div className="landing-final-cta-copy">
        <h2 id="landing-final-cta-title"><span>Learn to code with</span><strong>Y Coders</strong></h2>
        <button className="button" type="button" onClick={() => requestAuthentication('/', 'signup')}>Get Started <ArrowRight /></button>
      </div>
      <div className="landing-final-cta-visual" aria-hidden="true">
        <img src="/assets/landing/final-cta-reference.png" alt="" />
      </div>
    </section>
  </main><PublicFooter /></div>;
}

export function LandingPage() {
  return <LandingAnimationProvider><LandingPageContent /></LandingAnimationProvider>;
}
